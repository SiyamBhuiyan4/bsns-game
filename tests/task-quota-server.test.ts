import { describe, it, expect } from 'vitest';
import prisma from '@/lib/prisma';
import { targetStatuses } from '@/lib/task-quota-server';

describe('targetStatuses against the store', () => {
  it('counts completed links per day and splits a weekly target', async () => {
    const emp = await prisma.user.create({
      data: { name: 'Quota Tester', email: `quota-${Date.now()}@test.local`, password_hash: 'x', role: 'EMPLOYEE' },
    });
    const admin = await prisma.user.create({
      data: { name: 'Quota Admin', email: `qadmin-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMIN' },
    });
    const section = await prisma.groupSection.create({ data: { name: `Quota Sec ${Date.now()}`, created_by: admin.id } });

    // Sunday 1 and Monday 2 November: one completed link each, plus one undone that must not count.
    for (const [i, at, undone] of [[1, '2026-11-01T10:00:00+06:00', false], [2, '2026-11-02T10:00:00+06:00', false], [3, '2026-11-02T11:00:00+06:00', true]] as const) {
      const link = await prisma.groupLink.create({ data: { section_id: section.id, url: `https://example.com/q${Date.now()}-${i}` } });
      await prisma.linkCompletion.create({
        data: { group_link_id: link.id, employee_id: emp.id, completed_at: new Date(at), undone_at: undone ? new Date(at) : null },
      });
    }

    await prisma.sectionTarget.create({
      data: {
        employee_id: emp.id, section_id: section.id, metric_type: 'POSTS_DONE', target_value: 8,
        period_type: 'CUSTOM', period_start: new Date('2026-11-01'), period_end: new Date('2026-11-07'),
        off_days: [], set_by: admin.id,
      } as any,
    });

    const [status] = await targetStatuses([emp.id], '2026-11-02');
    expect(status.doneBeforeToday).toBe(1);
    expect(status.doneToday).toBe(1);
    expect(status.mandatory).toBe(1);
    expect(status.mandatoryLeft).toBe(0);
    expect(status.remaining).toBe(6);
    expect(status.sectionName).toBe(section.name);
    expect(await targetStatuses([emp.id], '2026-11-08')).toEqual([]);
  });
});
