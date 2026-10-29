import { describe, it, expect } from 'vitest';
import {
  calculateTargetForDateRange,
  getWinningTargetForDay,
  calculateEffectiveTargetsForRange,
  checkTargetOverlap,
} from '../src/lib/targets';
import { SectionTarget, PeriodType, MetricType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Target Periods & Pro-Rating Engine (Section 5 & Acceptance Test 8)', () => {
  const dummyTarget = (
    overrides: Partial<SectionTarget> = {}
  ): SectionTarget => ({
    id: 't-1',
    section_id: 'sec-1',
    off_days: [],
    metric_type: 'POSTS_DONE' as MetricType,
    target_value: new Decimal(100),
    period_type: 'MONTHLY' as PeriodType,
    period_start: new Date('2026-10-01'),
    period_end: new Date('2026-10-31'),
    set_by: 'admin-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  describe('Monthly Target Pro-Rating (Acceptance Test 8)', () => {
    it('should calculate daily share for 31-day month as ~3.23', () => {
      // October has 31 days. 1 day calculation
      const target = dummyTarget({
        target_value: new Decimal(100),
        period_type: 'MONTHLY',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      });

      const dayStart = new Date('2026-10-15');
      const dayEnd = new Date('2026-10-15');

      const result = calculateTargetForDateRange(target, dayStart, dayEnd);
      // 100 / 31 = 3.225806... rounded to 2 decimals is 3.23
      expect(Number(result.toFixed(2))).toBe(3.23);
    });

    it('should calculate 7-day custom sub-range in 31-day month as ~22.58', () => {
      const target = dummyTarget({
        target_value: new Decimal(100),
        period_type: 'MONTHLY',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      });

      const rangeStart = new Date('2026-10-01');
      const rangeEnd = new Date('2026-10-07'); // 7 days: 1, 2, 3, 4, 5, 6, 7

      const result = calculateTargetForDateRange(target, rangeStart, rangeEnd);
      // (100 / 31) * 7 = 22.5806... rounded to 2 decimals is 22.58
      expect(Number(result.toFixed(2))).toBe(22.58);
    });
  });

  describe('Daily Target Calculations', () => {
    it('should calculate N days * daily target', () => {
      const target = dummyTarget({
        target_value: new Decimal(10),
        period_type: 'DAILY',
        period_start: null,
        period_end: null,
      });

      const start = new Date('2026-10-01');
      const end = new Date('2026-10-05'); // 5 days

      const result = calculateTargetForDateRange(target, start, end);
      expect(result).toBe(50);
    });
  });

  describe('Specificity & Precedence (CUSTOM > MONTHLY > DAILY)', () => {
    it('should choose CUSTOM target over MONTHLY target for overlapping days', () => {
      const monthlyTarget = dummyTarget({
        id: 'monthly-1',
        period_type: 'MONTHLY',
        target_value: new Decimal(100),
        period_start: new Date('2026-10-01'),
      });

      const customTarget = dummyTarget({
        id: 'custom-1',
        period_type: 'CUSTOM',
        target_value: new Decimal(50),
        period_start: new Date('2026-10-10'),
        period_end: new Date('2026-10-15'),
      });

      const dailyTarget = dummyTarget({
        id: 'daily-1',
        period_type: 'DAILY',
        target_value: new Decimal(5),
      });

      const targets = [dailyTarget, monthlyTarget, customTarget];

      // On Oct 12 (falls in custom range), custom must win
      const winnerCustom = getWinningTargetForDay(targets, new Date('2026-10-12'));
      expect(winnerCustom?.id).toBe('custom-1');

      // On Oct 20 (outside custom, inside October), monthly must win
      const winnerMonthly = getWinningTargetForDay(targets, new Date('2026-10-20'));
      expect(winnerMonthly?.id).toBe('monthly-1');

      // On Nov 05 (outside October), daily must win
      const winnerDaily = getWinningTargetForDay(targets, new Date('2026-11-05'));
      expect(winnerDaily?.id).toBe('daily-1');
    });
  });

  describe('Target Overlap Detection', () => {
    it('should detect overlap when date ranges intersect', () => {
      const existing = {
        period_type: 'CUSTOM' as PeriodType,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-15'),
      };
      const candidate = {
        period_type: 'CUSTOM' as PeriodType,
        period_start: new Date('2026-10-10'),
        period_end: new Date('2026-10-25'),
      };

      expect(checkTargetOverlap(existing, candidate)).toBe(true);
    });

    it('should not detect overlap when ranges do not intersect', () => {
      const existing = {
        period_type: 'CUSTOM' as PeriodType,
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-10'),
      };
      const candidate = {
        period_type: 'CUSTOM' as PeriodType,
        period_start: new Date('2026-10-15'),
        period_end: new Date('2026-10-25'),
      };

      expect(checkTargetOverlap(existing, candidate)).toBe(false);
    });
  });
});
