import prisma from './prisma';
import { getDhakaDateString } from './date';
import { dayRequirement, lookbackStart, type DayRequirement, type QuotaPeriod } from './task-quota';

export interface QuotaStatus extends DayRequirement {
  quotaId: string;
  employeeId: string;
  sectionId: string | null;
  sectionName: string | null;
  period: QuotaPeriod;
  amount: number;
  offDays: number[];
}

/** Today's requirement for every active quota of the given employees (all, when omitted). */
export async function quotaStatuses(employeeIds?: string[], today = getDhakaDateString()): Promise<QuotaStatus[]> {
  const quotas = await prisma.taskQuota.findMany({
    where: { is_active: true, ...(employeeIds ? { employee_id: { in: employeeIds } } : {}) },
    include: { section: { select: { id: true, name: true } } },
  });
  if (!quotas.length) return [];

  const rules = quotas.map((q: any) => ({
    q,
    rule: { period: q.period as QuotaPeriod, amount: Number(q.amount), offDays: (q.off_days ?? []) as number[],
      startDate: q.created_at ? getDhakaDateString(new Date(q.created_at)) : undefined,
    },
  }));
  const earliest = rules
    .map(({ rule }) => {
      const start = lookbackStart(rule, today);
      return rule.startDate && rule.startDate > start ? rule.startDate : start;
    })
    .sort()[0];

  const completions = await prisma.linkCompletion.findMany({
    where: {
      employee_id: { in: [...new Set(quotas.map((q: any) => q.employee_id))] },
      undone_at: null,
      completed_at: { gte: new Date(`${earliest}T00:00:00+06:00`), lte: new Date(`${today}T23:59:59.999+06:00`) },
    },
    include: { group_link: { select: { section_id: true } } },
  });

  return rules.map(({ q, rule }) => {
    const done: Record<string, number> = {};
    for (const c of completions as any[]) {
      if (c.employee_id !== q.employee_id) continue;
      if (q.section_id && c.group_link?.section_id !== q.section_id) continue;
      const day = getDhakaDateString(new Date(c.completed_at));
      done[day] = (done[day] ?? 0) + 1;
    }
    return {
      ...dayRequirement(rule, today, done),
      quotaId: q.id,
      employeeId: q.employee_id,
      sectionId: q.section_id ?? null,
      sectionName: q.section?.name ?? null,
      period: rule.period,
      amount: rule.amount,
      offDays: rule.offDays,
    };
  });
}
