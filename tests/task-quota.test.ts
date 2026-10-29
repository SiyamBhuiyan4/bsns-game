import { describe, it, expect } from 'vitest';
import { dayRequirement, type QuotaRule } from '@/lib/task-quota';

// 2026-11-01 is a Sunday.
const days = (from: number, to: number, n = 1) => {
  const out: Record<string, number> = {};
  for (let d = from; d <= to; d++) out[`2026-11-${String(d).padStart(2, '0')}`] = n;
  return out;
};
const req = (rule: QuotaRule, today: string, done: Record<string, number>) => dayRequirement(rule, today, done)!;

describe('one-week range', () => {
  const rule: QuotaRule = { amount: 8, offDays: [], start: '2026-11-01', end: '2026-11-07' };

  it('asks 1 a day and leaves the rest optional', () => {
    const r = req(rule, '2026-11-02', days(1, 1));
    expect(r.dailyBase).toBe(1);
    expect(r.mandatory).toBe(1);
    expect(r.normal).toBe(6);
    expect(r.isLastWorkingDay).toBe(false);
  });

  it('makes the remaining 2 mandatory on the last day after 1 a day', () => {
    const r = req(rule, '2026-11-07', days(1, 6));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(2);
    expect(r.normal).toBe(0);
  });

  it('makes the whole shortfall mandatory on the last day', () => {
    expect(req(rule, '2026-11-07', days(1, 1)).mandatory).toBe(7);
  });

  it('lightens later days when extra normal tasks were done', () => {
    const r = req(rule, '2026-11-07', { '2026-11-01': 8 });
    expect(r.mandatory).toBe(0);
    expect(r.remaining).toBe(0);
  });

  it('counts work beyond the mandatory share against the normal tasks', () => {
    const r = req(rule, '2026-11-02', { '2026-11-02': 3 });
    expect(r.mandatory).toBe(1);
    expect(r.mandatoryLeft).toBe(0);
    expect(r.normal).toBe(7);
    expect(r.normalLeft).toBe(5);
  });

  it('is not running outside its range', () => {
    expect(dayRequirement(rule, '2026-10-31', {})).toBeNull();
    expect(dayRequirement(rule, '2026-11-08', {})).toBeNull();
  });
});

describe('week starting mid-week', () => {
  // Assigned Thursday 5 November with Fri and Sat off: runs to Wednesday 11th.
  const rule: QuotaRule = { amount: 8, offDays: [5, 6], start: '2026-11-05', end: '2026-11-11' };

  it('ignores work done before the range and does not close on the first day', () => {
    const r = req(rule, '2026-11-05', { '2026-11-02': 1 });
    expect(r.doneBeforeToday).toBe(0);
    expect(r.isLastWorkingDay).toBe(false);
    expect(r.mandatory).toBe(1);
    expect(r.remaining).toBe(8);
  });

  it('closes on the last working day of the range', () => {
    const r = req(rule, '2026-11-11', { '2026-11-05': 1, '2026-11-08': 1 });
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(6);
  });
});

describe('off days', () => {
  // Friday (5) off: six working days, Saturday is the last.
  const rule: QuotaRule = { amount: 8, offDays: [5], start: '2026-11-01', end: '2026-11-07' };

  it('asks nothing on the off day', () => {
    const r = req(rule, '2026-11-06', days(1, 5));
    expect(r.isOffDay).toBe(true);
    expect(r.mandatory).toBe(0);
    expect(r.normal).toBe(3);
  });

  it('closes the week on the last working day', () => {
    const r = req(rule, '2026-11-07', days(1, 5));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(3);
  });
});

describe('daily target', () => {
  it('is fully mandatory every working day', () => {
    const r = req({ amount: 3, offDays: [], start: '2026-11-03', end: '2026-11-03' }, '2026-11-03', {});
    expect(r.mandatory).toBe(3);
    expect(r.normal).toBe(0);
  });

  it('is zero on an off day', () => {
    expect(req({ amount: 3, offDays: [2], start: '2026-11-03', end: '2026-11-03' }, '2026-11-03', {}).mandatory).toBe(0);
  });
});

describe('month-long range', () => {
  // November 2026 has 30 days; 32 tasks is 1 a day with two extra.
  const rule: QuotaRule = { amount: 32, offDays: [], start: '2026-11-01', end: '2026-11-30' };

  it('gives the first week its share of the range', () => {
    const r = req(rule, '2026-11-01', {});
    expect(r.windowQuota).toBe(7); // round(32 * 7 / 30)
    expect(r.mandatory).toBe(1);
  });

  it('carries a missed week into the next one', () => {
    expect(req(rule, '2026-11-08', {}).windowQuota).toBe(15); // round(32 * 14 / 30) with nothing done yet
  });

  it('closes the full amount on the last working day', () => {
    const r = req(rule, '2026-11-30', days(1, 29));
    expect(r.isLastWorkingDay).toBe(true);
    expect(r.mandatory).toBe(3); // 32 - 29
  });
});
