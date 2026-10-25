import { describe, it, expect } from 'vitest';
import { calculateEmployeeScore } from '../src/lib/scoring';
import { MetricType } from '@prisma/client';

describe('Scoring Engine Unit Tests (Step 6)', () => {
  /**
   * Acceptance Test 9:
   * Worked example:
   * - Posts: target 100, done 80 → 0.80 × 20 = 16.00
   * - Sales: target 100000, achieved 80000 → 0.80 × 15 = 12.00
   * - Profit: target 20000, achieved 25000 → achievement 1.25, capped to 1.00 → 1.00 × 15 = 15.00
   * - New clients: target 50, achieved 25 → 0.50 × 10 = 5.00
   * - B2B orders: target 10, achieved 10 → 1.00 × 10 = 10.00
   * - Retention: target 20, achieved 15 → 0.75 × 15 = 11.25
   * - Follow-ups: target 200, achieved 180 → 0.90 × 15 = 13.50
   * Total = 16 + 12 + 15 + 5 + 10 + 11.25 + 13.50 = 82.75
   */
  it('should calculate the worked example to produce exactly 82.75 (Acceptance Test 9)', () => {
    const input = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 80 },
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 80000 },
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 25000 },
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 25 },
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 10 },
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 15 },
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 180 },
    };

    const result = calculateEmployeeScore(input);

    expect(result.metrics.POSTS_DONE.score).toBe(16.0);
    expect(result.metrics.SALES_AMOUNT.score).toBe(12.0);
    expect(result.metrics.PROFIT_AMOUNT.score).toBe(15.0);
    expect(result.metrics.NEW_CLIENTS.score).toBe(5.0);
    expect(result.metrics.B2B_ORDERS.score).toBe(10.0);
    expect(result.metrics.RETENTION_COUNT.score).toBe(11.25);
    expect(result.metrics.FOLLOWUPS_DONE.score).toBe(13.5);

    expect(result.totalScore).toBe(82.75);
    expect(result.isFailing).toBe(false);
  });

  /**
   * Acceptance Test 10:
   * Achievement cap at 100% (or configured cap).
   * Even if achieved is 200%, the capped score cannot exceed 100% of weight.
   */
  it('should cap achievement at 100% (Acceptance Test 10)', () => {
    const input = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 200 }, // 200%
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 300000 }, // 300%
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 50000 }, // 250%
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 100 }, // 200%
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 20 }, // 200%
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 40 }, // 200%
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 500 }, // 250%
    };

    const result = calculateEmployeeScore(input, { achievementCap: 1.0 });

    expect(result.metrics.POSTS_DONE.cappedAchievement).toBe(1.0);
    expect(result.metrics.SALES_AMOUNT.cappedAchievement).toBe(1.0);
    expect(result.metrics.PROFIT_AMOUNT.cappedAchievement).toBe(1.0);
    expect(result.metrics.NEW_CLIENTS.cappedAchievement).toBe(1.0);
    expect(result.metrics.B2B_ORDERS.cappedAchievement).toBe(1.0);
    expect(result.metrics.RETENTION_COUNT.cappedAchievement).toBe(1.0);
    expect(result.metrics.FOLLOWUPS_DONE.cappedAchievement).toBe(1.0);

    // Total must be exactly 100.00
    expect(result.totalScore).toBe(100.0);
  });

  /**
   * Acceptance Test 11:
   * Target is 0 or not set: that metric shows N/A and the total is re-scaled to 100.
   */
  it('should mark zero/unset target as N/A and re-scale remaining weights to 100 (Acceptance Test 11)', () => {
    // Suppose B2B_ORDERS (weight 10) and RETENTION_COUNT (weight 15) have target null or 0
    // Active weights: 100 - (10 + 15) = 75
    // Each of the remaining metrics achieved 100% of target
    const input = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 100 }, // weight 20 -> 20 / 75 * 100 = 26.6667
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 100000 }, // weight 15 -> 15 / 75 * 100 = 20.0
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 20000 }, // weight 15 -> 15 / 75 * 100 = 20.0
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 50 }, // weight 10 -> 10 / 75 * 100 = 13.3333
      [MetricType.B2B_ORDERS]: { target: 0, achieved: 0 }, // N/A
      [MetricType.RETENTION_COUNT]: { target: null, achieved: 0 }, // N/A
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 200 }, // weight 15 -> 15 / 75 * 100 = 20.0
    };

    const result = calculateEmployeeScore(input);

    expect(result.metrics.B2B_ORDERS.isNA).toBe(true);
    expect(result.metrics.RETENTION_COUNT.isNA).toBe(true);
    expect(result.activeWeightSum).toBe(75);

    // Sum of scaled scores should re-scale to 100.00
    expect(result.totalScore).toBe(100.0);
  });

  /**
   * Acceptance Test 12:
   * Score below 80% shows failing indicator.
   */
  it('should flag score below 80% as failing (Acceptance Test 12)', () => {
    // 50% achievement across the board = 50.00 score
    const input = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 50 },
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 50000 },
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 10000 },
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 25 },
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 5 },
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 10 },
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 100 },
    };

    const result = calculateEmployeeScore(input, { failingThreshold: 0.8 });

    expect(result.totalScore).toBe(50.0);
    expect(result.isFailing).toBe(true);
  });

  it('should support dynamic failing_threshold and custom section weights for 5 dimensions', () => {
    const input = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 100 },
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 70000 },
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 14000 },
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 35 },
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 7 },
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 15 },
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 150 },
    };

    // Custom section weights: Sales=40, Content=10, NewBuyers=20, Retention=15, Inbox=15
    const result = calculateEmployeeScore(input, {
      failingThreshold: 0.70,
      sectionWeights: {
        SALES_PROFIT: 40,
        CONTENT: 10,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 15,
      },
    });

    expect(result.sections.SALES_PROFIT.weight).toBe(40);
    expect(result.sections.CONTENT.weight).toBe(10);
    expect(result.sections.NEW_BUYERS_B2B.weight).toBe(20);
    expect(result.sections.RETENTION.weight).toBe(15);
    expect(result.sections.INBOX_FOLLOWUP.weight).toBe(15);

    // Sales: 0.7 * 20 + 0.7 * 20 = 28
    // Content: 1.0 * 10 = 10
    // New buyers: 0.7 * 10 + 0.7 * 10 = 14
    // Retention: 0.75 * 15 = 11.25
    // Inbox: 0.75 * 15 = 11.25
    // Total = 28 + 10 + 14 + 11.25 + 11.25 = 74.5
    expect(result.totalScore).toBe(74.5);
    // 74.5 >= 70, so should not be failing
    expect(result.isFailing).toBe(false);

    // With failingThreshold 0.75, 74.5 < 75 so should be failing
    const resultFailing = calculateEmployeeScore(input, {
      failingThreshold: 0.75,
      sectionWeights: {
        SALES_PROFIT: 40,
        CONTENT: 10,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 15,
      },
    });
    expect(resultFailing.isFailing).toBe(true);
  });
});
