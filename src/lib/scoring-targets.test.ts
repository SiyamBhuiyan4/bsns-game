import { describe, it, expect } from 'vitest';
import { calculateEmployeeScore, selectEmployeeTargets } from './scoring';

describe('no-targets scoring', () => {
  it('is not failing and flags hasNoTargets when nothing has a target', () => {
    const r = calculateEmployeeScore({});
    expect(r.totalScore).toBe(0);
    expect(r.hasNoTargets).toBe(true);
    expect(r.isFailing).toBe(false);
  });
  it('still fails when targets exist and score is low', () => {
    const r = calculateEmployeeScore({ SALES_AMOUNT: { target: 100, achieved: 10 } });
    expect(r.hasNoTargets).toBe(false);
    expect(r.isFailing).toBe(true);
  });
});

describe('selectEmployeeTargets', () => {
  const rows = [
    { id: 1, employee_id: 'a', section_id: null },
    { id: 2, employee_id: 'b', section_id: 's1' },
    { id: 3, employee_id: null, section_id: 's1' },
    { id: 4, employee_id: null, section_id: 's2' },
  ];
  it('keeps own null-section targets and unscoped assigned-section targets only', () => {
    expect(selectEmployeeTargets(rows, 'a', ['s1']).map((r) => r.id)).toEqual([1, 3]);
    expect(selectEmployeeTargets(rows, 'b', ['s1']).map((r) => r.id)).toEqual([2, 3]);
  });
});
