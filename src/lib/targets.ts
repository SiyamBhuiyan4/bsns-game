import { SectionTarget, PeriodType, MetricType } from '@prisma/client';
import { getDaysInMonth, format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { makeTranslator, type Lang } from './i18n/translate';

export interface CalculatedMetricTarget {
  metricType: MetricType;
  targetValue: number;
  dailyRate: number;
  periodDescription: string;
}

export interface LivePreviewInput {
  targetValue: number;
  periodType: PeriodType | string;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  metricType?: MetricType | string;
  /** Language for `previewText`. Defaults to Bangla. */
  lang?: Lang;
}

export interface LivePreviewResult {
  dailyRate: number;
  totalValue: number;
  days: number;
  previewText: string;
}

/**
 * Calculates live preview for target entry modal: "প্রতিদিন X, মোট Y".
 */
export function calculateTargetLivePreview(input: LivePreviewInput): LivePreviewResult {
  const L = makeTranslator(input.lang ?? 'bn');
  const numValue = Number(input.targetValue);
  if (isNaN(numValue) || numValue <= 0) {
    return {
      dailyRate: 0,
      totalValue: 0,
      days: 0,
      previewText: L('প্রতিদিন ০, মোট ০'),
    };
  }

  let days = 1;
  let dailyRate = numValue;
  const totalValue = numValue;

  if (input.periodType === 'DAILY') {
    days = 1;
    dailyRate = numValue;
  } else if (input.periodType === 'MONTHLY') {
    let monthDate = new Date();
    if (input.periodStart) {
      const s = typeof input.periodStart === 'string' ? input.periodStart : input.periodStart.toISOString();
      monthDate = new Date(s.length === 7 ? `${s}-01` : s);
    }
    days = getDaysInMonth(monthDate);
    dailyRate = Number((numValue / days).toFixed(2));
  } else if (input.periodType === 'CUSTOM') {
    if (input.periodStart && input.periodEnd) {
      const start = typeof input.periodStart === 'string' ? new Date(input.periodStart) : input.periodStart;
      const end = typeof input.periodEnd === 'string' ? new Date(input.periodEnd) : input.periodEnd;
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        days = eachDayOfInterval({ start, end }).length;
      }
    }
    days = Math.max(1, days);
    dailyRate = Number((numValue / days).toFixed(2));
  }

  const formatNum = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(2));
  const previewText = L(`প্রতিদিন ${formatNum(dailyRate)}, মোট ${formatNum(totalValue)}`);

  return {
    dailyRate,
    totalValue,
    days,
    previewText,
  };
}

/**
 * Checks whether two target periods overlap.
 */
export function checkTargetOverlap(
  existing: { period_type: PeriodType; period_start: Date | string | null; period_end: Date | string | null },
  candidate: { period_type: PeriodType; period_start: Date | string | null; period_end: Date | string | null }
): boolean {
  // If either is DAILY, it potentially overlaps all dates
  if (existing.period_type === 'DAILY' || candidate.period_type === 'DAILY') {
    return true;
  }

  const getInterval = (item: {
    period_type: PeriodType;
    period_start: Date | string | null;
    period_end: Date | string | null;
  }) => {
    if (!item.period_start) return null;
    const sDate = typeof item.period_start === 'string' ? new Date(item.period_start) : item.period_start;
    if (isNaN(sDate.getTime())) return null;

    if (item.period_type === 'MONTHLY') {
      const start = startOfMonth(sDate);
      const end = item.period_end
        ? typeof item.period_end === 'string'
          ? new Date(item.period_end)
          : item.period_end
        : endOfMonth(sDate);
      return { start: start.getTime(), end: end.getTime() };
    }

    const start = sDate.getTime();
    const end = item.period_end
      ? typeof item.period_end === 'string'
        ? new Date(item.period_end).getTime()
        : item.period_end.getTime()
      : start;
    return { start, end };
  };

  const int1 = getInterval(existing);
  const int2 = getInterval(candidate);

  if (int1 && int2) {
    return int1.start <= int2.end && int2.start <= int1.end;
  }

  return false;
}

/**
 * Checks if a candidate target overlaps with any existing target in a list for same section and metric.
 */
export function findOverlappingTarget<
  T extends {
    id?: string;
    section_id: string;
    metric_type: MetricType | string;
    period_type: PeriodType | string;
    period_start?: Date | string | null;
    period_end?: Date | string | null;
  }
>(
  existingTargets: T[],
  candidate: {
    id?: string;
    section_id: string;
    metric_type: MetricType | string;
    period_type: PeriodType | string;
    period_start?: Date | string | null;
    period_end?: Date | string | null;
  }
): T | null {
  for (const existing of existingTargets) {
    if (candidate.id && existing.id === candidate.id) continue;
    if (existing.section_id !== candidate.section_id) continue;
    if (existing.metric_type !== candidate.metric_type) continue;

    if (
      checkTargetOverlap(
        {
          period_type: existing.period_type as PeriodType,
          period_start: existing.period_start ?? null,
          period_end: existing.period_end ?? null,
        },
        {
          period_type: candidate.period_type as PeriodType,
          period_start: candidate.period_start ?? null,
          period_end: candidate.period_end ?? null,
        }
      )
    ) {
      return existing;
    }
  }
  return null;
}

/**
 * Resolves the target value for a single date across multiple configured targets.
 * Precedence rule: CUSTOM > MONTHLY > DAILY
 */
export function getWinningTargetForDay(
  targets: SectionTarget[],
  date: Date
): SectionTarget | null {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dateTime = new Date(dateStr).getTime();

  // 1. Check CUSTOM targets that cover this day
  const customTarget = targets.find((t) => {
    if (t.period_type !== 'CUSTOM' || !t.period_start || !t.period_end) return false;
    const start = new Date(format(new Date(t.period_start), 'yyyy-MM-dd')).getTime();
    const end = new Date(format(new Date(t.period_end), 'yyyy-MM-dd')).getTime();
    return dateTime >= start && dateTime <= end;
  });
  if (customTarget) return customTarget;

  // 2. Check MONTHLY targets matching this month
  const targetYearMonth = format(date, 'yyyy-MM');
  const monthlyTarget = targets.find((t) => {
    if (t.period_type !== 'MONTHLY' || !t.period_start) return false;
    const tYearMonth = format(new Date(t.period_start), 'yyyy-MM');
    return tYearMonth === targetYearMonth;
  });
  if (monthlyTarget) return monthlyTarget;

  // 3. Fallback to DAILY target
  const dailyTarget = targets.find((t) => t.period_type === 'DAILY');
  if (dailyTarget) return dailyTarget;

  return null;
}

/**
 * Calculates the total target for a date range for a given target.
 * - DAILY: daily value * number of days
 * - MONTHLY: (monthly value / days in month) for each day in range
 * - CUSTOM: (custom value / total days in custom range) for each day in range
 */
export function calculateTargetForDateRange(
  target: SectionTarget,
  startDate: Date,
  endDate: Date
): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  let total = 0;
  const numTargetValue = Number(target.target_value);

  if (target.period_type === 'DAILY') {
    return numTargetValue * days.length;
  }

  if (target.period_type === 'MONTHLY') {
    // For each day, divide monthly target by days in that specific month
    for (const day of days) {
      const daysInMonthCount = getDaysInMonth(day);
      total += numTargetValue / daysInMonthCount;
    }
    return total;
  }

  if (target.period_type === 'CUSTOM') {
    if (!target.period_start || !target.period_end) {
      return numTargetValue;
    }
    const tStart = new Date(target.period_start);
    const tEnd = new Date(target.period_end);
    const customDays = eachDayOfInterval({
      start: tStart,
      end: tEnd,
    });
    const totalCustomDays = Math.max(1, customDays.length);
    const dailyShare = numTargetValue / totalCustomDays;

    const overlapStart = startDate > tStart ? startDate : tStart;
    const overlapEnd = endDate < tEnd ? endDate : tEnd;

    if (overlapStart > overlapEnd) {
      return 0;
    }

    const overlapDays = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
    return dailyShare * overlapDays.length;
  }

  return total;
}

/**
 * Pro-rates targets for all metrics across a date range.
 */
export function calculateEffectiveTargetsForRange(
  targets: SectionTarget[],
  startDate: Date,
  endDate: Date
): Record<MetricType, number> {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const result: Partial<Record<MetricType, number>> = {};

  // Group targets by metric type
  const metricGroups = new Map<MetricType, SectionTarget[]>();
  for (const t of targets) {
    const list = metricGroups.get(t.metric_type) || [];
    list.push(t);
    metricGroups.set(t.metric_type, list);
  }

  for (const [metric, metricTargets] of metricGroups.entries()) {
    let metricTotal = 0;
    for (const day of days) {
      const winningTarget = getWinningTargetForDay(metricTargets, day);
      if (winningTarget) {
        const numVal = Number(winningTarget.target_value);
        if (winningTarget.period_type === 'DAILY') {
          metricTotal += numVal;
        } else if (winningTarget.period_type === 'MONTHLY') {
          const daysInMonthCount = getDaysInMonth(day);
          metricTotal += numVal / daysInMonthCount;
        } else if (winningTarget.period_type === 'CUSTOM') {
          if (winningTarget.period_start && winningTarget.period_end) {
            const customDays = eachDayOfInterval({
              start: new Date(winningTarget.period_start),
              end: new Date(winningTarget.period_end),
            });
            metricTotal += numVal / Math.max(1, customDays.length);
          } else {
            metricTotal += numVal;
          }
        }
      }
    }
    result[metric] = metricTotal;
  }

  return result as Record<MetricType, number>;
}

/**
 * Pure bulk copy helper for copying monthly targets from one month to another.
 */
export function bulkCopyMonthToMonth<
  T extends {
    id?: string;
    section_id: string;
    metric_type: MetricType | string;
    target_value: unknown;
    period_type: PeriodType | string;
    period_start?: Date | string | null;
    period_end?: Date | string | null;
  }
>(
  sourceTargets: T[],
  fromMonth: string,
  toMonth: string,
  options?: {
    sectionId?: string;
    existingDestinationTargets?: T[];
  }
): {
  created: Array<Omit<T, 'id'> & { period_start: Date; period_end: Date }>;
  updated: Array<T>;
  totalProcessed: number;
} {
  const toStart = startOfMonth(new Date(`${toMonth}-01`));
  const toEnd = endOfMonth(toStart);

  const eligibleSources = sourceTargets.filter((t) => {
    if (t.period_type !== 'MONTHLY') return false;
    if (options?.sectionId && t.section_id !== options.sectionId) return false;
    if (t.period_start) {
      const ym = format(new Date(t.period_start), 'yyyy-MM');
      if (ym !== fromMonth) return false;
    }
    return true;
  });

  const created: Array<Omit<T, 'id'> & { period_start: Date; period_end: Date }> = [];
  const updated: Array<T> = [];
  const existingDest = options?.existingDestinationTargets || [];

  for (const src of eligibleSources) {
    const existing = existingDest.find(
      (dest) =>
        dest.section_id === src.section_id &&
        dest.metric_type === src.metric_type &&
        dest.period_type === 'MONTHLY' &&
        dest.period_start &&
        format(new Date(dest.period_start), 'yyyy-MM') === toMonth
    );

    if (existing) {
      updated.push({
        ...existing,
        target_value: src.target_value,
      });
    } else {
      const rest = { ...src };
      delete (rest as Record<string, unknown>).id;
      created.push({
        ...rest,
        period_type: 'MONTHLY',
        period_start: toStart,
        period_end: toEnd,
      });
    }
  }

  return {
    created,
    updated,
    totalProcessed: created.length + updated.length,
  };
}

/**
 * Pure bulk copy helper for copying targets from one section to another.
 */
export function bulkCopySectionToSection<
  T extends {
    id?: string;
    section_id: string;
    metric_type: MetricType | string;
    target_value: unknown;
    period_type: PeriodType | string;
    period_start?: Date | string | null;
    period_end?: Date | string | null;
  }
>(
  sourceTargets: T[],
  fromSectionId: string,
  toSectionId: string,
  options?: {
    existingDestinationTargets?: T[];
  }
): {
  created: Array<Omit<T, 'id'> & { section_id: string }>;
  updated: Array<T>;
  totalProcessed: number;
} {
  const eligibleSources = sourceTargets.filter((t) => t.section_id === fromSectionId);
  const created: Array<Omit<T, 'id'> & { section_id: string }> = [];
  const updated: Array<T> = [];
  const existingDest = options?.existingDestinationTargets || [];

  for (const src of eligibleSources) {
    const existing = existingDest.find(
      (dest) =>
        dest.section_id === toSectionId &&
        dest.metric_type === src.metric_type &&
        dest.period_type === src.period_type &&
        (dest.period_start && src.period_start
          ? new Date(dest.period_start).getTime() === new Date(src.period_start).getTime()
          : true)
    );

    if (existing) {
      updated.push({
        ...existing,
        target_value: src.target_value,
      });
    } else {
      const rest = { ...src };
      delete (rest as Record<string, unknown>).id;
      created.push({
        ...rest,
        section_id: toSectionId,
      });
    }
  }

  return {
    created,
    updated,
    totalProcessed: created.length + updated.length,
  };
}

/**
 * Budget Progress and Threshold Evaluation.
 * Green < 80%, Yellow 80-100%, Red > 100%.
 */
export interface BudgetStatus {
  budgetAmount: number;
  actualSpend: number;
  spendPercentage: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
  color: 'emerald' | 'amber' | 'red';
  statusLabelBn: string;
}

export function calculateBudgetStatus(
  budgetAmount: number,
  actualSpend: number,
  /** Language for `statusLabelBn`. Defaults to Bangla. */
  lang: Lang = 'bn'
): BudgetStatus {
  const L = makeTranslator(lang);
  const spendPercentage = budgetAmount > 0 ? (actualSpend / budgetAmount) * 100 : 0;
  let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
  let color: 'emerald' | 'amber' | 'red' = 'emerald';
  let statusLabelBn = L('নিরাপদ সীমা (< ৮০%)');

  if (spendPercentage > 100) {
    status = 'EXCEEDED';
    color = 'red';
    statusLabelBn = L('বাজেট অতিক্রান্ত (> ১০০%)');
  } else if (spendPercentage >= 80) {
    status = 'WARNING';
    color = 'amber';
    statusLabelBn = L('সতর্কবার্তা (৮০-১০০%)');
  }

  return {
    budgetAmount,
    actualSpend,
    spendPercentage: Number(spendPercentage.toFixed(2)),
    status,
    color,
    statusLabelBn,
  };
}
