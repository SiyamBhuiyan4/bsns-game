import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { AuditAction, UserRole } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock session
const mockSessionUser = {
  id: '',
  userId: '',
  name: '',
  email: '',
  role: 'ADMIN' as 'ADMIN' | 'EMPLOYEE',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockSessionUser.userId) return null;
    return { ...mockSessionUser };
  }),
  requireAuth: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    return { ...mockSessionUser };
  }),
  requireAdmin: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    if (mockSessionUser.role !== 'ADMIN') throw new Error('FORBIDDEN');
    return { ...mockSessionUser };
  }),
  requireEmployee: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    if (mockSessionUser.role !== 'EMPLOYEE') throw new Error('FORBIDDEN');
    return { ...mockSessionUser };
  }),
}));

import { GET as getAuditLogs } from '../src/app/api/admin/audit/route';

describe('Audit Log API Integration Tests', () => {
  const runId = Math.random().toString(36).substring(2, 9);
  const testPrefix = `AuditTest_${runId}`;

  let adminUser: any;
  let employeeUser: any;
  let createdAuditIds: string[] = [];

  beforeAll(async () => {
    console.log('TEST DATABASE_URL:', process.env.DATABASE_URL);
    try {
      await prisma.$connect();
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      await prisma.$connect();
    }
    const dummyPasswordHash = '$2a$12$e80yq9N0k8l8M9v5.XmYmOG6rM9V6Y.N.O1J2K3L4M5N6O7P8Q9R';

    adminUser = await prisma.user.create({
      data: {
        name: 'Audit Admin User',
        email: `audit_admin_${Date.now()}_${runId}@example.com`,
        password_hash: dummyPasswordHash,
        role: UserRole.ADMIN,
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: 'Audit Employee User',
        email: `audit_employee_${Date.now()}_${runId}@example.com`,
        password_hash: dummyPasswordHash,
        role: UserRole.EMPLOYEE,
      },
    });

    // Create 5 test audit logs with testPrefix
    const log1 = await prisma.auditLog.create({
      data: {
        actor_id: adminUser.id,
        action: AuditAction.CREATE,
        entity: `${testPrefix}_Product`,
        entity_id: 'prod-001',
        payload: { title: 'Product 1', price: 500 },
        created_at: new Date('2026-10-20T10:00:00.000Z'),
      },
    });

    const log2 = await prisma.auditLog.create({
      data: {
        actor_id: adminUser.id,
        action: AuditAction.UPDATE,
        entity: `${testPrefix}_Product`,
        entity_id: 'prod-001',
        payload: { old: { price: 500 }, new: { price: 600 } },
        created_at: new Date('2026-10-21T11:00:00.000Z'),
      },
    });

    const log3 = await prisma.auditLog.create({
      data: {
        actor_id: employeeUser.id,
        action: AuditAction.ENTRY_SAVE,
        entity: `${testPrefix}_DailyEntry`,
        entity_id: 'entry-001',
        payload: { posts: 15, confirm: true },
        created_at: new Date('2026-10-22T08:30:00.000Z'),
      },
    });

    const log4 = await prisma.auditLog.create({
      data: {
        actor_id: employeeUser.id,
        action: AuditAction.LEAD_UPDATE,
        entity: `${testPrefix}_Lead`,
        entity_id: 'lead-001',
        payload: { old: { status: 'NEW' }, new: { status: 'CONTACTED' } },
        created_at: new Date('2026-10-23T14:15:00.000Z'),
      },
    });

    const log5 = await prisma.auditLog.create({
      data: {
        actor_id: null,
        action: AuditAction.LOGIN,
        entity: `${testPrefix}_Auth`,
        entity_id: null,
        payload: { status: 'SYSTEM_EVENT' },
        created_at: new Date('2026-10-24T09:00:00.000Z'),
      },
    });

    createdAuditIds = [log1.id, log2.id, log3.id, log4.id, log5.id];
  });

  afterAll(async () => {
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { id: { in: createdAuditIds } },
            { entity: { startsWith: testPrefix } },
          ],
        },
      });

      const userIds = [adminUser?.id, employeeUser?.id].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    } catch (e) {
      console.warn('Audit test cleanup warning:', e);
    }
  });

  describe('1. Role Security (Admin Only)', () => {
    it('should reject unauthenticated request with 403', async () => {
      mockSessionUser.userId = '';
      const req = new NextRequest('http://localhost/api/admin/audit');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should reject non-admin (EMPLOYEE) request with 403', async () => {
      mockSessionUser.userId = employeeUser.id;
      mockSessionUser.id = employeeUser.id;
      mockSessionUser.role = 'EMPLOYEE';
      mockSessionUser.name = employeeUser.name;
      mockSessionUser.email = employeeUser.email;

      const req = new NextRequest('http://localhost/api/admin/audit');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should allow ADMIN user to view audit logs with 200', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.role = 'ADMIN';
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;

      const req = new NextRequest('http://localhost/api/admin/audit');
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.logs)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('2. Query Filtering', () => {
    beforeEach(() => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.role = 'ADMIN';
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
    });

    it('should filter logs by actor_id', async () => {
      const req = new NextRequest(`http://localhost/api/admin/audit?actor_id=${employeeUser.id}&entity=${testPrefix}`);
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs.length).toBe(2);
      for (const log of data.logs) {
        expect(log.actor_id).toBe(employeeUser.id);
        expect(log.actor.id).toBe(employeeUser.id);
        expect(log.actor.email).toBe(employeeUser.email);
      }
    });

    it('should filter logs by action', async () => {
      const req = new NextRequest(`http://localhost/api/admin/audit?action=ENTRY_SAVE&entity=${testPrefix}`);
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs.length).toBe(1);
      expect(data.logs[0].action).toBe(AuditAction.ENTRY_SAVE);
      expect(data.logs[0].id).toBe(createdAuditIds[2]);
    });

    it('should filter logs by entity (case-insensitive substring match)', async () => {
      const req = new NextRequest(`http://localhost/api/admin/audit?entity=${testPrefix.toLowerCase()}_product`);
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs.length).toBe(2);
      expect(data.logs.every((l: any) => l.entity === `${testPrefix}_Product`)).toBe(true);
    });

    it('should filter logs by date range (startDate & endDate)', async () => {
      // log1: 2026-10-20, log2: 2026-10-21, log3: 2026-10-22, log4: 2026-10-23, log5: 2026-10-24
      const req = new NextRequest(`http://localhost/api/admin/audit?startDate=2026-10-21T00:00:00.000Z&endDate=2026-10-22T23:59:59.999Z&entity=${testPrefix}`);
      const res = await getAuditLogs(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.logs.length).toBe(2);
      const ids = data.logs.map((l: any) => l.id);
      expect(ids).toContain(createdAuditIds[1]); // log2 (2026-10-21)
      expect(ids).toContain(createdAuditIds[2]); // log3 (2026-10-22)
    });
  });

  describe('3. Pagination & Sorting', () => {
    beforeEach(() => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.role = 'ADMIN';
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
    });

    it('should paginate results with page and limit params', async () => {
      const reqPage1 = new NextRequest(`http://localhost/api/admin/audit?entity=${testPrefix}&limit=2&page=1`);
      const res1 = await getAuditLogs(reqPage1);
      const data1 = await res1.json();

      expect(data1.logs.length).toBe(2);
      expect(data1.pagination.page).toBe(1);
      expect(data1.pagination.limit).toBe(2);
      expect(data1.pagination.total).toBe(5);
      expect(data1.pagination.totalPages).toBe(3);

      const reqPage2 = new NextRequest(`http://localhost/api/admin/audit?entity=${testPrefix}&limit=2&page=2`);
      const res2 = await getAuditLogs(reqPage2);
      const data2 = await res2.json();

      expect(data2.logs.length).toBe(2);
      expect(data2.pagination.page).toBe(2);

      // Verify that page 1 and page 2 contain distinct logs
      const page1Ids = data1.logs.map((l: any) => l.id);
      const page2Ids = data2.logs.map((l: any) => l.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('should sort logs by created_at descending', async () => {
      const req = new NextRequest(`http://localhost/api/admin/audit?entity=${testPrefix}&limit=10&page=1`);
      const res = await getAuditLogs(req);
      const data = await res.json();

      expect(data.logs.length).toBe(5);
      for (let i = 0; i < data.logs.length - 1; i++) {
        const currentDate = new Date(data.logs[i].created_at).getTime();
        const nextDate = new Date(data.logs[i + 1].created_at).getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });
  });
});
