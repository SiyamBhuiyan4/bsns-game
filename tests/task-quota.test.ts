import { describe, it, expect } from 'vitest';
import { dayRequirement, type QuotaRule } from '@/lib/task-quota';

// 2026-11-01 is a Sunday, so the week is 1-7 November.
const days = (from: number, to: number, n = 1) => {
  const out: Record<string, number> = {};
  for (let d = from; d <= to; d++) out[`2026-11-${String(d).padStart(2, '0')}`] = n;
  return out;
};

describe('weekly quota', () => {
  const rule: QuotaRule = { period: 'WEEKLY', amount: 8, offDays: [] };

  it('asks 1 a day and leaves the rest optional', () => {
    const r = dayRequirement(rule, '2026-11-02', days(1, 1));
    expect(r.dailyBase).toBe(1);
    expect(r.mandatory).toBe(1);
    expect(r.normal).toBe(6);
    expect(r.isLastWorkingDay).toBe(false);
  });

  it('makes the remaining 2 mandatory on the last day after 1 a day', () => {
    const r = dayRequirement(rule, '2026-11-07', days(1, 6));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(2);
    expect(r.normal).toBe(0);
  });

  it('makes the whole shortfall mandatory on the last day', () => {
    const r = dayRequirement(rule, '2026-11-07', days(1, 1));
    expect(r.mandatory).toBe(7);
  });

  it('lightens later days when extra normal tasks were done', () => {
    const r = dayRequirement(rule, '2026-11-07', { '2026-11-01': 8 });
    expect(r.mandatory).toBe(0);
    expect(r.remaining).toBe(0);
  });

  it('counts work beyond the mandatory share against the normal tasks', () => {
    const r = dayRequirement(rule, '2026-11-02', { '2026-11-02': 3 });
    expect(r.mandatory).toBe(1);
    expect(r.mandatoryLeft).toBe(0);
    expect(r.normal).toBe(7);
    expect(r.normalLeft).toBe(5);
  });
});

describe('quota assigned mid-week', () => {
  // Fri and Sat off, assigned on Thursday 5 November, the last working day.
  const rule: QuotaRule = { period: 'WEEKLY', amount: 8, offDays: [5, 6], startDate: '2026-11-05' };

  it('ignores work done before the quota was assigned', () => {
    const r = dayRequirement(rule, '2026-11-05', { '2026-11-02': 1 });
    expect(r.doneBeforeToday).toBe(0);
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(8);
    expect(r.remaining).toBe(8);
  });

  it('counts work from the assignment day on', () => {
    const r = dayRequirement(rule, '2026-11-05', { '2026-11-02': 1, '2026-11-05': 3 });
    expect(r.doneToday).toBe(3);
    expect(r.remaining).toBe(5);
  });
});

describe('off days', () => {
  // Friday (5) off: six working days, Saturday is the last.
  const rule: QuotaRule = { period: 'WEEKLY', amount: 8, offDays: [5] };

  it('asks nothing on the off day', () => {
    const r = dayRequirement(rule, '2026-11-06', days(1, 5));
    expect(r.isOffDay).toBe(true);
    expect(r.mandatory).toBe(0);
    expect(r.normal).toBe(3);
  });

  it('closes the week on the last working day', () => {
    const r = dayRequirement(rule, '2026-11-07', days(1, 5));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(3);
  });
});

describe('daily quota', () => {
  it('is fully mandatory every working day', () => {
    const r = dayRequirement({ period: 'DAILY', amount: 3, offDays: [] }, '2026-11-03', {});
    expect(r.mandatory).toBe(3);
    expect(r.normal).toBe(0);
  });

  it('is zero on an off day', () => {
    const r = dayRequirement({ period: 'DAILY', amount: 3, offDays: [2] }, '2026-11-03', {});
    expect(r.mandatory).toBe(0);
  });
});

describe('monthly quota', () => {
  // November 2026 has 30 days; 32 tasks is 1 a day with two extra.
  const rule: QuotaRule = { period: 'MONTHLY', amount: 32, offDays: [] };

  it('gives the first week its share of the month', () => {
    const r = dayRequirement(rule, '2026-11-01', {});
    expect(r.windowQuota).toBe(7); // round(32 * 7 / 30)
    expect(r.mandatory).toBe(1);
  });

  it('carries a missed week into the next one', () => {
    const r = dayRequirement(rule, '2026-11-08', {});
    expect(r.windowQuota).toBe(15); // round(32 * 14 / 30) with nothing done yet
  });

  it('closes the full month quota on the last working day', () => {
    const r = dayRequirement(rule, '2026-11-30', days(1, 29));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(3); // 32 - 29
  });
});
