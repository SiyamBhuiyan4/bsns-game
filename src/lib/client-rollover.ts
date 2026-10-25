import prisma from '@/lib/prisma';
import { MetricType } from '@prisma/client';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { format, eachDayOfInterval, addDays, subDays } from 'date-fns';

export interface DailyClientRolloverState {
  date: string;
  employeeId: string;
  incomingSurplus: number;
  addedToday: number;
  totalAvailable: number;
  targetToday: number;
  consumedToday: number;
  outgoingSurplus: number;
  percentage: number;
}

/**
 * Calculates daily client rollover and surplus banking for an employee.
 * Rules requested by user:
 * 1. Even if target is 0 or unassigned, employee can add clients; they stay banked in surplus until assigned.
 * 2. If target is T and employee has A clients (incoming surplus + added today), exactly min(A, T) is consumed for today's quota.
 * 3. Daily percentage is capped at 100% (e.g. 5 brought for target 3 = 100%).
 * 4. The excess surplus (A - min(A, T)) automatically rolls over to the next day as already achieved.
 */
export async function calculateClientRolloverForEmployee(
  employeeId: string,
  untilDateStr: string = getDhakaDateString(),
  lookbackDays: number = 60
): Promise<Map<string, DailyClientRolloverState>> {
  const untilDate = parseDateOnly(untilDateStr);
  const startDate = subDays(untilDate, lookbackDays);

  // 1. Fetch all client leads created by this employee
  const leads = await prisma.lead.findMany({
    where: {
      owner_id: employeeId,
      created_at: {
        gte: new Date(`${format(startDate, 'yyyy-MM-dd')}T00:00:00+06:00`),
        lte: new Date(`${untilDateStr}T23:59:59.999+06:00`),
      },
    },
    select: {
      id: true,
      created_at: true,
    },
  });

  // Also check DailyEntry for NEW_CLIENTS
  const entries = await prisma.dailyEntry.findMany({
    where: {
      employee_id: employeeId,
      metric_type: MetricType.NEW_CLIENTS,
      entry_date: {
        gte: startDate,
        lte: untilDate,
      },
    },
  });

  // Map added clients per date (take max of leads created and DailyEntry)
  const dateCounts = new Map<string, number>();
  for (const l of leads) {
    const dStr = getDhakaDateString(new Date(l.created_at));
    dateCounts.set(dStr, (dateCounts.get(dStr) || 0) + 1);
  }
  for (const e of entries) {
    const dStr = format(e.entry_date, 'yyyy-MM-dd');
    const entryVal = Math.round(Number(e.value));
    const current = dateCounts.get(dStr) || 0;
    dateCounts.set(dStr, Math.max(current, entryVal));
  }

  // 2. Fetch targets for NEW_CLIENTS for this employee or their sections
  const assignments = await prisma.assignment.findMany({
    where: { employee_id: employeeId },
    select: { section_id: true },
  });
  const sectionIds = assignments.map((a: { section_id: string }) => a.section_id);

  const targets = await prisma.sectionTarget.findMany({
    where: {
      metric_type: MetricType.NEW_CLIENTS,
      OR: [
        { section_id: { in: sectionIds } },
        { id: { not: '' } }, // general pool fallback
      ],
    },
  });

  // 3. Chronological simulation of rollover
  const dayInterval = eachDayOfInterval({ start: startDate, end: untilDate });
  const resultMap = new Map<string, DailyClientRolloverState>();

  let bankedSurplus = 0;

  for (const d of dayInterval) {
    const dStr = format(d, 'yyyy-MM-dd');
    const addedToday = dateCounts.get(dStr) || 0;

    // Daily target for this day
    const effective = calculateEffectiveTargetsForRange(targets, d, d);
    const targetToday = Math.round(effective.NEW_CLIENTS || 0);

    const incomingSurplus = bankedSurplus;
    const totalAvailable = incomingSurplus + addedToday;

    let consumedToday = 0;
    let outgoingSurplus = 0;
    let percentage = 0;

    if (targetToday > 0) {
      consumedToday = Math.min(totalAvailable, targetToday);
      outgoingSurplus = totalAvailable - consumedToday;
      percentage = Math.min(100, Math.round((consumedToday / targetToday) * 100));
    } else {
      // Unassigned (target = 0):
      // All clients stay banked until assigned next time
      consumedToday = 0;
      outgoingSurplus = totalAvailable;
      percentage = addedToday > 0 ? 100 : 0;
    }

    bankedSurplus = outgoingSurplus;

    resultMap.set(dStr, {
      date: dStr,
      employeeId,
      incomingSurplus,
      addedToday,
      totalAvailable,
      targetToday,
      consumedToday,
      outgoingSurplus,
      percentage,
    });
  }

  return resultMap;
}

/**
 * Gets the current active client bank/rollover for an employee today.
 */
export async function getTodayClientRollover(
  employeeId: string,
  todayStr: string = getDhakaDateString()
): Promise<DailyClientRolloverState> {
  const map = await calculateClientRolloverForEmployee(employeeId, todayStr, 45);
  const state = map.get(todayStr);
  if (state) return state;

  return {
    date: todayStr,
    employeeId,
    incomingSurplus: 0,
    addedToday: 0,
    totalAvailable: 0,
    targetToday: 0,
    consumedToday: 0,
    outgoingSurplus: 0,
    percentage: 0,
  };
}
