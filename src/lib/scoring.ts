import { MetricType } from '@prisma/client';
import { makeTranslator, type Lang } from './i18n/translate';

export interface MetricScoreDetail {
  metricType: MetricType;
  bengaliName: string;
  sectionName: string;
  target: number | null;
  achieved: number;
  weight: number;
  scaledWeight: number;
  rawAchievement: number;
  cappedAchievement: number;
  score: number;
  scaledScore: number;
  isNA: boolean;
}

export interface SectionScoreDetail {
  sectionKey: 'SALES_PROFIT' | 'CONTENT' | 'NEW_BUYERS_B2B' | 'RETENTION' | 'INBOX_FOLLOWUP';
  bengaliName: string;
  weight: number;
  score: number;
  scaledScore: number;
  metrics: MetricScoreDetail[];
}

export interface EmployeeScoreResult {
  totalScore: number;
  isFailing: boolean;
  /** True when no metric has a target (nothing to score): not failing, just not applicable. */
  hasNoTargets: boolean;
  achievementCap: number;
  failingThreshold: number;
  activeWeightSum: number;
  sections: Record<string, SectionScoreDetail>;
  metrics: Record<string, MetricScoreDetail>;
}

export const DEFAULT_METRIC_WEIGHTS: Record<string, number> = {
  SALES_AMOUNT: 15,
  PROFIT_AMOUNT: 15,
  POSTS_DONE: 20,
  NEW_CLIENTS: 10,
  B2B_ORDERS: 10,
  RETENTION_COUNT: 15,
  FOLLOWUPS_DONE: 15,
};

export const METRIC_DISPLAY_INFO: Record<
  string,
  { bn: string; sectionKey: 'SALES_PROFIT' | 'CONTENT' | 'NEW_BUYERS_B2B' | 'RETENTION' | 'INBOX_FOLLOWUP'; sectionBn: string }
> = {
  SALES_AMOUNT: {
    bn: 'মোট বিক্রি',
    sectionKey: 'SALES_PROFIT',
    sectionBn: 'বিক্রি ও লাভ',
  },
  PROFIT_AMOUNT: {
    bn: 'লাভ',
    sectionKey: 'SALES_PROFIT',
    sectionBn: 'বিক্রি ও লাভ',
  },
  POSTS_DONE: {
    bn: 'কনটেন্ট ও পোস্ট বাস্তবায়ন',
    sectionKey: 'CONTENT',
    sectionBn: 'কনটেন্ট ও পোস্ট বাস্তবায়ন',
  },
  NEW_CLIENTS: {
    bn: 'নতুন ক্রেতা',
    sectionKey: 'NEW_BUYERS_B2B',
    sectionBn: 'নতুন ক্রেতা ও B2B বিক্রি',
  },
  B2B_ORDERS: {
    bn: 'B2B অর্ডার',
    sectionKey: 'NEW_BUYERS_B2B',
    sectionBn: 'নতুন ক্রেতা ও B2B বিক্রি',
  },
  RETENTION_COUNT: {
    bn: 'পুরোনো ক্রেতা ধরে রাখা',
    sectionKey: 'RETENTION',
    sectionBn: 'পুরোনো ক্রেতা ধরে রাখা',
  },
  FOLLOWUPS_DONE: {
    bn: 'ফলোআপ সম্পন্ন',
    sectionKey: 'INBOX_FOLLOWUP',
    sectionBn: 'ইনবক্স ও ফলোআপ',
  },
};

/** Reads the admin-configured section weights out of a ScoringSettings row (undefined if unset). */
export function readSectionWeights(
  settings: { section_weights?: unknown } | null | undefined
): Record<string, number> | undefined {
  const sw = settings?.section_weights;
  return sw && typeof sw === 'object' ? (sw as Record<string, number>) : undefined;
}

/**
 * Picks the targets that count for one employee: those scoped to the employee
 * directly (even with no section), plus unscoped section targets for a section
 * the employee is assigned to. Another employee's targets never leak in.
 */
export function selectEmployeeTargets<T extends { employee_id?: string | null; section_id?: string | null }>(
  targets: T[],
  employeeId: string,
  assignedSectionIds: Array<string | null | undefined>
): T[] {
  return targets.filter((t) =>
    t.employee_id
      ? t.employee_id === employeeId
      : !!t.section_id && assignedSectionIds.includes(t.section_id)
  );
}

/**
 * Calculates scores for an employee based on achieved vs target values.
 *
 * Rules:
 * - achievement = achieved / target
 * - capped_achievement = min(achievement, achievement_cap)
 * - metric_score = capped_achievement * metric_weight
 * - If target is 0 or not set (null/undefined): metric is N/A, and remaining active weights are scaled proportionally to 100.
 * - Score < (failingThreshold * 100) flags as failing.
 */
export function calculateEmployeeScore(
  data: Partial<Record<MetricType, { target: number | null | undefined; achieved: number }>>,
  options: {
    weights?: Partial<Record<MetricType, number>>;
    achievementCap?: number;
    failingThreshold?: number;
    sectionWeights?: Partial<Record<string, number>>;
    /** Language for the display names in the result. Defaults to Bangla. */
    lang?: Lang;
  } = {}
): EmployeeScoreResult {
  const cap = options.achievementCap ?? 1.0;
  const threshold = options.failingThreshold ?? 0.8;
  // Only the display names follow this; every number stays language-independent.
  const L = makeTranslator(options.lang ?? 'bn');

  let customMetricWeights: Partial<Record<MetricType, number>> | undefined = options.weights;
  if (!customMetricWeights && options.sectionWeights) {
    const sw = options.sectionWeights;
    const salesWeight = sw.SALES_PROFIT !== undefined ? Number(sw.SALES_PROFIT) : 30;
    const contentWeight = sw.CONTENT !== undefined ? Number(sw.CONTENT) : 20;
    const newBuyersWeight = sw.NEW_BUYERS_B2B !== undefined ? Number(sw.NEW_BUYERS_B2B) : 20;
    const retentionWeight = sw.RETENTION !== undefined ? Number(sw.RETENTION) : 15;
    const followupWeight = sw.INBOX_FOLLOWUP !== undefined ? Number(sw.INBOX_FOLLOWUP) : 15;

    customMetricWeights = {
      SALES_AMOUNT: Number((salesWeight / 2).toFixed(2)),
      PROFIT_AMOUNT: Number((salesWeight / 2).toFixed(2)),
      POSTS_DONE: contentWeight,
      NEW_CLIENTS: Number((newBuyersWeight / 2).toFixed(2)),
      B2B_ORDERS: Number((newBuyersWeight / 2).toFixed(2)),
      RETENTION_COUNT: retentionWeight,
      FOLLOWUPS_DONE: followupWeight,
    };
  }

  const weights: Record<string, number> = {
    ...DEFAULT_METRIC_WEIGHTS,
    ...(customMetricWeights || {}),
  };

  const metricTypes: MetricType[] = [
    MetricType.POSTS_DONE,
    MetricType.SALES_AMOUNT,
    MetricType.PROFIT_AMOUNT,
    MetricType.NEW_CLIENTS,
    MetricType.B2B_ORDERS,
    MetricType.RETENTION_COUNT,
    MetricType.FOLLOWUPS_DONE,
  ];

  let activeWeightSum = 0;
  const metricsResult: Partial<Record<MetricType, MetricScoreDetail>> = {};

  // First pass: evaluate each metric
  for (const m of metricTypes) {
    const entry = data[m] || { target: null, achieved: 0 };
    const weight = weights[m] ?? DEFAULT_METRIC_WEIGHTS[m];
    const target = entry.target;
    const achieved = Math.max(0, entry.achieved || 0);

    const isNA = target === null || target === undefined || target <= 0;

    let rawAchievement = 0;
    let cappedAchievement = 0;
    let score = 0;

    if (!isNA) {
      activeWeightSum += weight;
      rawAchievement = achieved / target;
      cappedAchievement = Math.min(rawAchievement, cap);
      score = cappedAchievement * weight;
    }

    const info = METRIC_DISPLAY_INFO[m];

    metricsResult[m] = {
      metricType: m,
      bengaliName: L(info.bn),
      sectionName: L(info.sectionBn),
      target: isNA ? null : target,
      achieved,
      weight,
      scaledWeight: weight, // will be adjusted if scaling is needed
      rawAchievement,
      cappedAchievement,
      score,
      scaledScore: score,
      isNA,
    };
  }

  // Second pass: apply N/A scaling if activeWeightSum > 0 and < 100
  const scaleFactor = activeWeightSum > 0 ? 100 / activeWeightSum : 1;
  let totalScore = 0;

  for (const m of metricTypes) {
    const detail = metricsResult[m]!;
    if (!detail.isNA && activeWeightSum > 0) {
      detail.scaledWeight = Number((detail.weight * scaleFactor).toFixed(4));
      detail.scaledScore = Number((detail.score * scaleFactor).toFixed(4));
      totalScore += detail.scaledScore;
    }
  }

  totalScore = Number(totalScore.toFixed(2));

  // Build section grouping
  const sections: Record<string, SectionScoreDetail> = {
    SALES_PROFIT: {
      sectionKey: 'SALES_PROFIT',
      bengaliName: L('বিক্রি ও লাভ (Sales & Profit)'),
      weight: 0,
      score: 0,
      scaledScore: 0,
      metrics: [],
    },
    CONTENT: {
      sectionKey: 'CONTENT',
      bengaliName: L('কনটেন্ট ও পোস্ট বাস্তবায়ন (Content)'),
      weight: 0,
      score: 0,
      scaledScore: 0,
      metrics: [],
    },
    NEW_BUYERS_B2B: {
      sectionKey: 'NEW_BUYERS_B2B',
      bengaliName: L('নতুন ক্রেতা ও B2B বিক্রি (New Buyers/B2B)'),
      weight: 0,
      score: 0,
      scaledScore: 0,
      metrics: [],
    },
    RETENTION: {
      sectionKey: 'RETENTION',
      bengaliName: L('পুরোনো ক্রেতা ধরে রাখা (Retention)'),
      weight: 0,
      score: 0,
      scaledScore: 0,
      metrics: [],
    },
    INBOX_FOLLOWUP: {
      sectionKey: 'INBOX_FOLLOWUP',
      bengaliName: L('ইনবক্স ও ফলোআপ (Inbox & Follow-up)'),
      weight: 0,
      score: 0,
      scaledScore: 0,
      metrics: [],
    },
  };

  for (const m of metricTypes) {
    const detail = metricsResult[m]!;
    const secKey = METRIC_DISPLAY_INFO[m].sectionKey;
    sections[secKey].metrics.push(detail);
    sections[secKey].weight += detail.weight;
    sections[secKey].score += detail.score;
    sections[secKey].scaledScore += detail.scaledScore;
  }

  // Round section scores and weights
  for (const k of Object.keys(sections)) {
    sections[k].weight = Number(sections[k].weight.toFixed(2));
    sections[k].score = Number(sections[k].score.toFixed(2));
    sections[k].scaledScore = Number(sections[k].scaledScore.toFixed(2));
  }

  const hasNoTargets = activeWeightSum <= 0;
  const isFailing = activeWeightSum > 0 && totalScore < threshold * 100;

  return {
    totalScore,
    isFailing,
    hasNoTargets,
    achievementCap: cap,
    failingThreshold: threshold,
    activeWeightSum,
    sections,
    metrics: metricsResult as Record<MetricType, MetricScoreDetail>,
  };
}

/**
 * Calculates total score for an employee based on metrics data.
 */
export function calculateTotalScore(
  data: Partial<Record<MetricType, { target: number | null | undefined; achieved: number }>>,
  options?: {
    weights?: Partial<Record<MetricType, number>>;
    achievementCap?: number;
    failingThreshold?: number;
    sectionWeights?: Partial<Record<string, number>>;
  }
): number {
  const result = calculateEmployeeScore(data, options);
  return result.totalScore;
}

/**
 * Calculates score for a specific section (e.g. SALES_PROFIT, CONTENT, etc.)
 */
export function calculateSectionScore(
  sectionKey:
    | 'SALES_PROFIT'
    | 'CONTENT'
    | 'NEW_BUYERS_B2B'
    | 'RETENTION'
    | 'INBOX_FOLLOWUP'
    | 'sales_profit'
    | 'content'
    | 'new_buyers_b2b'
    | 'retention'
    | 'inbox_followup'
    | string,
  data: Partial<Record<MetricType, { target: number | null | undefined; achieved: number }>>,
  options?: {
    weights?: Partial<Record<MetricType, number>>;
    achievementCap?: number;
    failingThreshold?: number;
    sectionWeights?: Partial<Record<string, number>>;
  }
): number {
  const result = calculateEmployeeScore(data, options);
  const keyMap: Record<string, string> = {
    sales_profit: 'SALES_PROFIT',
    content: 'CONTENT',
    new_buyers_b2b: 'NEW_BUYERS_B2B',
    retention: 'RETENTION',
    inbox_followup: 'INBOX_FOLLOWUP',
  };
  const normalizedKey = keyMap[sectionKey] || sectionKey.toUpperCase();
  return result.sections[normalizedKey]?.scaledScore ?? 0;
}
