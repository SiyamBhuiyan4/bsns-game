import { describe, it, expect, vi, beforeAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { signToken } from '../src/lib/auth';

// An employee token lives for 7 days; a deactivated account must lose access straight away.
let cookieValue: string | undefined;
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}));

import { getSession } from '../src/lib/session';

describe('getSession account check', () => {
  let emp: any;

  beforeAll(async () => {
    const runId = Math.random().toString(36).slice(2, 8);
    emp = await prisma.user.create({
      data: { name: 'Session Emp', email: `session_${runId}@test.com`, password_hash: 'x', role: 'EMPLOYEE' },
    });
    cookieValue = await signToken({ userId: emp.id, name: emp.name, email: emp.email, role: 'EMPLOYEE' });
  });

  it('accepts an active employee', async () => {
    expect((await getSession())?.userId).toBe(emp.id);
  });

  it('rejects a token issued before the password was reset, and accepts a new one', async () => {
    await prisma.user.update({ where: { id: emp.id }, data: { password_changed_at: new Date(Date.now() + 2000) } });
    expect(await getSession()).toBeNull();
    await prisma.user.update({ where: { id: emp.id }, data: { password_changed_at: new Date(Date.now() - 60_000) } });
    expect((await getSession())?.userId).toBe(emp.id);
  });

  it('rejects the same token once the employee is deactivated', async () => {
    await prisma.user.update({ where: { id: emp.id }, data: { is_active: false } });
    expect(await getSession()).toBeNull();
  });

  it('rejects a token for a deleted employee', async () => {
    await prisma.user.delete({ where: { id: emp.id } });
    expect(await getSession()).toBeNull();
  });
});
