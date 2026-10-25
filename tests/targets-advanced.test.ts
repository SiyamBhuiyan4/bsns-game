import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  calculateTargetLivePreview,
  calculateTargetForDateRange,
  checkTargetOverlap,
  findOverlappingTarget,
  getWinningTargetForDay,
  calculateEffectiveTargetsForRange,
  bulkCopyMonthToMonth,
  bulkCopySectionToSection,
  calculateBudgetStatus,
} from '../src/lib/targets';
import { calculateEmployeeScore, DEFAULT_METRIC_WEIGHTS } from '../src/lib/scoring';
import { SectionTarget, PeriodType, MetricType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Targets & Budgets Advanced Engine Auditing (Section 5 & 8.6)', () => {
  const mockTarget = (
    overrides: Partial<Omit<SectionTarget, 'target_value'>> & { target_value?: Decimal | number } = {}
  ): SectionTarget =>
    ({
      id: 'mock-target-1',
      section_id: 'sec-retail',
      metric_type: MetricType.SALES_AMOUNT,
      target_value: new Decimal(100000),
      period_type: PeriodType.MONTHLY,
      period_start: new Date('2026-10-01'),
      period_end: new Date('2026-10-31'),
      set_by: 'admin-usr-1',
      created_at: new Date('2026-10-01'),
      updated_at: new Date('2026-10-01'),
      ...overrides,
    } as unknown as SectionTarget);

  describe('1. Live Preview Calculation ("প্রতিদিন X, মোট Y")', () => {
    it('should calculate live preview for DAILY target', () => {
      const preview = calculateTargetLivePreview({
        targetValue: 20,
        periodType: 'DAILY',
      });

      expect(preview.days).toBe(1);
      expect(preview.dailyRate).toBe(20);
      expect(preview.totalValue).toBe(20);
      expect(preview.previewText).toBe('প্রতিদিন 20, মোট 20');
    });

    it('should calculate live preview for MONTHLY target in a 31-day month (October)', () => {
      const preview = calculateTargetLivePreview({
        targetValue: 100,
        periodType: 'MONTHLY',
        periodStart: '2026-10-01',
      });

      expect(preview.days).toBe(31);
      // 100 / 31 = 3.2258... rounded to 2 decimals is 3.23
      expect(preview.dailyRate).toBe(3.23);
      expect(preview.totalValue).toBe(100);
      expect(preview.previewText).toBe('প্রতিদিন 3.23, মোট 100');
    });

    it('should calculate live preview for MONTHLY target in a 30-day month (November)', () => {
      const preview = calculateTargetLivePreview({
        targetValue: 90,
        periodType: 'MONTHLY',
        periodStart: '2026-11-01',
      });

      expect(preview.days).toBe(30);
      expect(preview.dailyRate).toBe(3);
      expect(preview.totalValue).toBe(90);
      expect(preview.previewText).toBe('প্রতিদিন 3, মোট 90');
    });

    it('should calculate live preview for MONTHLY target in a 28-day month (February non-leap)', () => {
      const preview = calculateTargetLivePreview({
        targetValue: 280,
        periodType: 'MONTHLY',
        periodStart: '2026-02-01',
      });

      expect(preview.days).toBe(28);
      expect(preview.dailyRate).toBe(10);
      expect(preview.totalValue).toBe(280);
      expect(preview.previewText).toBe('প্রতিদিন 10, মোট 280');
    });

    it('should calculate live preview for CUSTOM target across a 5-day span', () => {
      const preview = calculateTargetLivePreview({
        targetValue: 50,
        periodType: 'CUSTOM',
        periodStart: '2026-10-10',
        periodEnd: '2026-10-14', // 5 days inclusive: 10, 11, 12, 13, 14
      });

      expect(preview.days).toBe(5);
      expect(preview.dailyRate).toBe(10);
      expect(preview.totalValue).toBe(50);
      expect(preview.previewText).toBe('প্রতিদিন 10, মোট 50');
    });

    it('should handle zero or negative target values gracefully', () => {
      const zeroPreview = calculateTargetLivePreview({
        targetValue: 0,
        periodType: 'MONTHLY',
      });
      expect(zeroPreview.dailyRate).toBe(0);
      expect(zeroPreview.totalValue).toBe(0);
      expect(zeroPreview.previewText).toBe('প্রতিদিন ০, মোট ০');
    });
  });

  describe('2. Overlap Resolution & Specificity Priority (CUSTOM > MONTHLY > DAILY)', () => {
    const dailyTarget = mockTarget({
      id: 'target-daily',
      period_type: PeriodType.DAILY,
      target_value: new Decimal(10),
      period_start: null,
      period_end: null,
    });

    const monthlyTarget = mockTarget({
      id: 'target-monthly',
      period_type: PeriodType.MONTHLY,
      target_value: new Decimal(310),
      period_start: new Date('2026-10-01'),
      period_end: new Date('2026-10-31'),
    });

    const customTarget = mockTarget({
      id: 'target-custom',
      period_type: PeriodType.CUSTOM,
      target_value: new Decimal(100),
      period_start: new Date('2026-10-10'),
      period_end: new Date('2026-10-14'), // 5 days
    });

    const allTargets = [dailyTarget, monthlyTarget, customTarget];

    it('CUSTOM target takes priority over MONTHLY and DAILY on overlapping dates', () => {
      // Oct 12 is inside customTarget (Oct 10-14)
      const winner = getWinningTargetForDay(allTargets, new Date('2026-10-12'));
      expect(winner?.id).toBe('target-custom');
      expect(winner?.period_type).toBe(PeriodType.CUSTOM);
    });

    it('MONTHLY target takes priority over DAILY when date is outside CUSTOM but in month', () => {
      // Oct 20 is outside customTarget (Oct 10-14), but inside monthlyTarget (October)
      const winner = getWinningTargetForDay(allTargets, new Date('2026-10-20'));
      expect(winner?.id).toBe('target-monthly');
      expect(winner?.period_type).toBe(PeriodType.MONTHLY);
    });

    it('DAILY target is used as fallback when date is outside CUSTOM and MONTHLY', () => {
      // Nov 05 is outside October
      const winner = getWinningTargetForDay(allTargets, new Date('2026-11-05'));
      expect(winner?.id).toBe('target-daily');
      expect(winner?.period_type).toBe(PeriodType.DAILY);
    });

    it('should correctly calculate effective targets across mixed periods', () => {
      // Date range Oct 9 to Oct 15 (7 days):
      // Oct 9: monthly (310/31 = 10)
      // Oct 10, 11, 12, 13, 14: custom (100/5 = 20 each day = 100)
      // Oct 15: monthly (310/31 = 10)
      // Total should be: 10 + 100 + 10 = 120
      const rangeStart = new Date('2026-10-09');
      const rangeEnd = new Date('2026-10-15');

      const effective = calculateEffectiveTargetsForRange(allTargets, rangeStart, rangeEnd);
      expect(effective[MetricType.SALES_AMOUNT]).toBe(120);
    });

    it('detects overlap between monthly target and intersecting custom candidate', () => {
      const existing = {
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-10-01'),
        period_end: null, // should automatically infer end of month
      };
      const candidate = {
        period_type: PeriodType.CUSTOM,
        period_start: new Date('2026-10-15'),
        period_end: new Date('2026-10-20'),
      };

      expect(checkTargetOverlap(existing, candidate)).toBe(true);
    });

    it('finds overlapping target from existing list for same section and metric', () => {
      const existingList = [
        mockTarget({
          id: 'target-existing-1',
          section_id: 'sec-1',
          metric_type: MetricType.POSTS_DONE,
          period_type: PeriodType.MONTHLY,
          period_start: new Date('2026-10-01'),
          period_end: new Date('2026-10-31'),
        }),
      ];

      // Overlapping candidate: same section and metric in Oct 2026
      const overlapping = findOverlappingTarget(existingList, {
        section_id: 'sec-1',
        metric_type: MetricType.POSTS_DONE,
        period_type: PeriodType.CUSTOM,
        period_start: '2026-10-05',
        period_end: '2026-10-10',
      });
      expect(overlapping).not.toBeNull();
      expect(overlapping?.id).toBe('target-existing-1');

      // Non-overlapping candidate: different metric
      const nonOverlappingMetric = findOverlappingTarget(existingList, {
        section_id: 'sec-1',
        metric_type: MetricType.SALES_AMOUNT,
        period_type: PeriodType.CUSTOM,
        period_start: '2026-10-05',
        period_end: '2026-10-10',
      });
      expect(nonOverlappingMetric).toBeNull();

      // Non-overlapping candidate: different section
      const nonOverlappingSection = findOverlappingTarget(existingList, {
        section_id: 'sec-2',
        metric_type: MetricType.POSTS_DONE,
        period_type: PeriodType.CUSTOM,
        period_start: '2026-10-05',
        period_end: '2026-10-10',
      });
      expect(nonOverlappingSection).toBeNull();
    });
  });

  describe('3. Bulk Copy Engine', () => {
    const octoberTargets = [
      mockTarget({
        id: 'oct-sales',
        section_id: 'sec-1',
        metric_type: MetricType.SALES_AMOUNT,
        target_value: 50000,
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      }),
      mockTarget({
        id: 'oct-posts',
        section_id: 'sec-1',
        metric_type: MetricType.POSTS_DONE,
        target_value: 120,
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      }),
    ];

    it('copies monthly targets to next month (Month to Month)', () => {
      const result = bulkCopyMonthToMonth(octoberTargets, '2026-10', '2026-11');

      expect(result.totalProcessed).toBe(2);
      expect(result.created.length).toBe(2);
      expect(result.updated.length).toBe(0);

      // Verify destination dates for November (2026-11-01 to 2026-11-30)
      const copiedSales = result.created.find((t) => t.metric_type === MetricType.SALES_AMOUNT);
      expect(copiedSales?.target_value).toBe(50000);
      expect(format(copiedSales!.period_start, 'yyyy-MM-dd')).toBe('2026-11-01');
      expect(format(copiedSales!.period_end, 'yyyy-MM-dd')).toBe('2026-11-30');
    });

    it('updates existing targets in destination month when already present', () => {
      const existingNovemberTargets = [
        mockTarget({
          id: 'nov-existing-sales',
          section_id: 'sec-1',
          metric_type: MetricType.SALES_AMOUNT,
          target_value: 40000,
          period_type: PeriodType.MONTHLY,
          period_start: new Date('2026-11-01'),
          period_end: new Date('2026-11-30'),
        }),
      ];

      const result = bulkCopyMonthToMonth(octoberTargets, '2026-10', '2026-11', {
        existingDestinationTargets: existingNovemberTargets,
      });

      // 1 updated (sales), 1 created (posts)
      expect(result.totalProcessed).toBe(2);
      expect(result.updated.length).toBe(1);
      expect(result.created.length).toBe(1);

      expect(result.updated[0].id).toBe('nov-existing-sales');
      expect(result.updated[0].target_value).toBe(50000); // Updated to Oct value
    });

    it('copies targets from one section to another (Section to Section)', () => {
      const result = bulkCopySectionToSection(octoberTargets, 'sec-1', 'sec-2');

      expect(result.totalProcessed).toBe(2);
      expect(result.created.length).toBe(2);
      expect(result.created.every((t) => t.section_id === 'sec-2')).toBe(true);
    });
  });

  describe('4. Budgets & Scoring Independence', () => {
    it('evaluates budget progress thresholds (Green < 80%, Yellow 80-100%, Red > 100%)', () => {
      const budgetAmount = 100000;

      // Safe limit (< 80%)
      const safe = calculateBudgetStatus(budgetAmount, 50000); // 50%
      expect(safe.status).toBe('SAFE');
      expect(safe.color).toBe('emerald');
      expect(safe.spendPercentage).toBe(50);
      expect(safe.statusLabelBn).toContain('নিরাপদ');

      // Warning threshold (80-100%)
      const warning80 = calculateBudgetStatus(budgetAmount, 80000); // 80%
      expect(warning80.status).toBe('WARNING');
      expect(warning80.color).toBe('amber');

      const warning95 = calculateBudgetStatus(budgetAmount, 95000); // 95%
      expect(warning95.status).toBe('WARNING');
      expect(warning95.color).toBe('amber');

      // Exceeded limit (> 100%)
      const exceeded = calculateBudgetStatus(budgetAmount, 105000); // 105%
      expect(exceeded.status).toBe('EXCEEDED');
      expect(exceeded.color).toBe('red');
      expect(exceeded.statusLabelBn).toContain('অতিক্রান্ত');
    });

    it('confirms budget/ad spend is NOT a scoring metric (spend does not lower points)', () => {
      // In scoring engine, DEFAULT_METRIC_WEIGHTS must not include AD_SPEND
      expect(DEFAULT_METRIC_WEIGHTS['AD_SPEND']).toBeUndefined();

      // Calculation with 100% achievement across active core metrics
      const perfectPerformance = {
        [MetricType.POSTS_DONE]: { target: 100, achieved: 100 },
        [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 100000 },
        [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 20000 },
        [MetricType.NEW_CLIENTS]: { target: 50, achieved: 50 },
        [MetricType.B2B_ORDERS]: { target: 10, achieved: 10 },
        [MetricType.RETENTION_COUNT]: { target: 20, achieved: 20 },
        [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 200 },
      };

      const scoreResult = calculateEmployeeScore(perfectPerformance);
      // Total score is 100
      expect(scoreResult.totalScore).toBe(100);
      expect(scoreResult.isFailing).toBe(false);

      // Verify that AD_SPEND does not appear in metric scores
      expect(scoreResult.metrics['AD_SPEND']).toBeUndefined();
    });
  });

  describe('5. Comprehensive Coverage for All 12 MetricTypes & All PeriodTypes', () => {
    const all12Metrics: MetricType[] = [
      MetricType.POSTS_DONE,
      MetricType.SALES_AMOUNT,
      MetricType.PROFIT_AMOUNT,
      MetricType.NEW_CLIENTS,
      MetricType.B2B_ORDERS,
      MetricType.RETENTION_COUNT,
      MetricType.FOLLOWUPS_DONE,
      MetricType.CONFIRMED_ORDERS,
      MetricType.NEW_LEADS,
      MetricType.AD_SPEND,
      MetricType.B2B_INQUIRIES,
      MetricType.B2B_INQUIRY_VALUE,
    ];

    it('supports live preview calculation for all 12 MetricTypes and all 3 PeriodTypes', () => {
      const periodTypes: PeriodType[] = [PeriodType.DAILY, PeriodType.MONTHLY, PeriodType.CUSTOM];

      for (const metric of all12Metrics) {
        for (const period of periodTypes) {
          const preview = calculateTargetLivePreview({
            targetValue: 310,
            periodType: period,
            periodStart: period === PeriodType.CUSTOM ? '2026-10-01' : '2026-10',
            periodEnd: period === PeriodType.CUSTOM ? '2026-10-10' : undefined,
            metricType: metric,
          });

          expect(preview.days).toBeGreaterThanOrEqual(1);
          expect(preview.totalValue).toBe(310);
          expect(preview.dailyRate).toBeGreaterThan(0);
          expect(preview.previewText).toContain('প্রতিদিন');
          expect(preview.previewText).toContain('মোট 310');
        }
      }
    });

    it('pro-rates partial periods accurately when query range clips custom window', () => {
      // 10-day custom target (Oct 10 - Oct 19), total 1000 => 100/day
      const customTarget = mockTarget({
        id: 'clip-test',
        period_type: PeriodType.CUSTOM,
        target_value: new Decimal(1000),
        period_start: new Date('2026-10-10'),
        period_end: new Date('2026-10-19'),
      });

      // Query sub-range: 3 days inside (Oct 12 - Oct 14) => 3 * 100 = 300
      const subInside = calculateTargetForDateRange(
        customTarget,
        new Date('2026-10-12'),
        new Date('2026-10-14')
      );
      expect(subInside).toBe(300);

      // Query range partially overlapping: Oct 08 - Oct 11 (2 days overlap: Oct 10, 11) => 2 * 100 = 200
      const partialOverlap = calculateTargetForDateRange(
        customTarget,
        new Date('2026-10-08'),
        new Date('2026-10-11')
      );
      expect(partialOverlap).toBe(200);

      // Query range completely outside: Oct 01 - Oct 05 => 0
      const outside = calculateTargetForDateRange(
        customTarget,
        new Date('2026-10-01'),
        new Date('2026-10-05')
      );
      expect(outside).toBe(0);
    });

    it('prevents duplicate overlapping targets for all period types', () => {
      // 1. DAILY with DAILY overlap
      const dailyExisting = {
        period_type: PeriodType.DAILY,
        period_start: null,
        period_end: null,
      };
      const dailyCandidate = {
        period_type: PeriodType.DAILY,
        period_start: null,
        period_end: null,
      };
      expect(checkTargetOverlap(dailyExisting, dailyCandidate)).toBe(true);

      // 2. MONTHLY with same MONTHLY overlap
      const octMonthly1 = {
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      };
      const octMonthly2 = {
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-10-01'),
        period_end: null,
      };
      expect(checkTargetOverlap(octMonthly1, octMonthly2)).toBe(true);

      // 3. MONTHLY with different month: NO overlap
      const novMonthly = {
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-11-01'),
        period_end: new Date('2026-11-30'),
      };
      expect(checkTargetOverlap(octMonthly1, novMonthly)).toBe(false);

      // 4. CUSTOM with non-overlapping CUSTOM
      const custom1 = {
        period_type: PeriodType.CUSTOM,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-05'),
      };
      const custom2 = {
        period_type: PeriodType.CUSTOM,
        period_start: new Date('2026-10-06'),
        period_end: new Date('2026-10-10'),
      };
      expect(checkTargetOverlap(custom1, custom2)).toBe(false);

      // 5. CUSTOM with overlapping CUSTOM
      const custom3 = {
        period_type: PeriodType.CUSTOM,
        period_start: new Date('2026-10-05'),
        period_end: new Date('2026-10-12'),
      };
      expect(checkTargetOverlap(custom1, custom3)).toBe(true);
    });

    it('bulk copies all 12 metrics from section-to-section seamlessly', () => {
      const allMetricTargets = all12Metrics.map((metric, idx) =>
        mockTarget({
          id: `src-${metric}`,
          section_id: 'sec-source',
          metric_type: metric,
          target_value: 100 * (idx + 1),
          period_type: PeriodType.MONTHLY,
          period_start: new Date('2026-10-01'),
          period_end: new Date('2026-10-31'),
        })
      );

      const copyResult = bulkCopySectionToSection(allMetricTargets, 'sec-source', 'sec-dest');
      expect(copyResult.totalProcessed).toBe(12);
      expect(copyResult.created.length).toBe(12);
      expect(copyResult.created.every((t) => t.section_id === 'sec-dest')).toBe(true);

      for (const metric of all12Metrics) {
        const found = copyResult.created.find((t) => t.metric_type === metric);
        expect(found).toBeDefined();
      }
    });
  });
});
