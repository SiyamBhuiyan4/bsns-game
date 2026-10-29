import prisma from './prisma';
import { getDhakaDateString } from './date';
import { dayRequirement, monthBounds, type DayRequirement } from './task-quota';

export interface TargetStatus extends DayRequirement {
  targetId: string;
  employeeId: string;
  metricType: string;
  sectionId: string | null;
  sectionName: string | null;
  periodType: string;
  amount: number;
  offDays: number[];
  rangeStart: string;
  rangeEnd: string;
}

const dhakaDay = (d: Date | string) => getDhakaDateString(new Date(d));

/** The days a target's amount is owed over, or null when it is not running today. */
export function targetRange(
  t: { period_type: string; period_start: Date | string | null; period_end: Date | string | null },
  today: string
): { start: string; end: string } | null {
  const start = t.period_start ? dhakaDay(t.period_start) : null;
  if (t.period_type === 'DAILY') return !start || start <= today ? { start: today, end: today } : null;
  if (!start) return t.period_type === 'MONTHLY' ? monthBounds(today) : null;
  const end = t.period_end ? dhakaDay(t.period_end) : t.period_type === 'MONTHLY' ? monthBounds(start).end : null;
  if (!end || start > today || end < today) return null;
  return { start, end };
}

/** Today's mandatory and optional share of every running employee target (all employees, when omitted). */
export async function targetStatuses(employeeIds?: string[], today = getDhakaDateString()): Promise<TargetStatus[]> {
  const targets = await prisma.sectionTarget.findMany({
    where: { employee_id: employeeIds ? { in: employeeIds } : { not: null } },
    include: { section: { select: { id: true, name: true } } },
  });
  const running = targets
    .map((t: any) => ({ t, range: targetRange(t, today) }))
    .filter((x): x is { t: any; range: { start: string; end: string } } => x.range !== null);
  if (!running.length) return [];

  const earliest = running.map((x) => x.range.start).sort()[0];
  const employees = [...new Set(running.map((x) => x.t.employee_id as string))];
  const from = new Date(`${earliest}T00:00:00+06:00`);
  const to = new Date(`${today}T23:59:59.999+06:00`);

  const needsLinks = running.some((x) => x.t.metric_type === 'POSTS_DONE');
  const needsEntries = running.some((x) => x.t.metric_type !== 'POSTS_DONE');
  const [completions, entries] = await Promise.all([
    needsLinks
      ? prisma.linkCompletion.findMany({
          where: { employee_id: { in: employees }, undone_at: null, completed_at: { gte: from, lte: to } },
          include: { group_link: { select: { section_id: true } } },
        })
      : [],
    needsEntries
      ? prisma.dailyEntry.findMany({
          where: { employee_id: { in: employees }, entry_date: { gte: new Date(`${earliest}T00:00:00Z`), lte: new Date(`${today}T23:59:59.999Z`) } },
        })
      : [],
  ]);

  return running.map(({ t, range }) => {
    const done: Record<string, number> = {};
    if (t.metric_type === 'POSTS_DONE') {
      for (const c of completions as any[]) {
        if (c.employee_id !== t.employee_id) continue;
        if (t.section_id && c.group_link?.section_id !== t.section_id) continue;
        const day = dhakaDay(c.completed_at);
        done[day] = (done[day] ?? 0) + 1;
      }
    } else {
      for (const e of entries as any[]) {
        if (e.employee_id !== t.employee_id || e.metric_type !== t.metric_type) continue;
        const day = new Date(e.entry_date).toISOString().slice(0, 10);
        done[day] = (done[day] ?? 0) + (Number(e.value) || 0);
      }
    }
    const offDays = ((t.off_days ?? []) as number[]).map(Number);
    const amount = Number(t.target_value);
    return {
      ...dayRequirement({ amount, offDays, start: range.start, end: range.end }, today, done)!,
      targetId: t.id,
      employeeId: t.employee_id,
      metricType: t.metric_type,
      sectionId: t.section_id ?? null,
      sectionName: t.section?.name ?? null,
      periodType: t.period_type,
      amount,
      offDays,
      rangeStart: range.start,
      rangeEnd: range.end,
    };
  });
}
