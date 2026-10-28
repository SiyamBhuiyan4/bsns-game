import { describe, it, expect } from 'vitest';
import prisma from '@/lib/prisma';
import { quotaStatuses } from '@/lib/task-quota-server';

describe('quotaStatuses against the store', () => {
  it('counts completed links per day and applies the weekly rule', async () => {
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

    await prisma.taskQuota.create({
      data: { employee_id: emp.id, section_id: section.id, period: 'WEEKLY', amount: 8, off_days: [], created_by: admin.id },
    });

    const [status] = await quotaStatuses([emp.id], '2026-11-02');
    expect(status.doneBeforeToday).toBe(1);
    expect(status.doneToday).toBe(1);
    expect(status.mandatory).toBe(1);
    expect(status.mandatoryLeft).toBe(0);
    expect(status.remaining).toBe(6);
    expect(status.sectionName).toBe(section.name);
  });
});
