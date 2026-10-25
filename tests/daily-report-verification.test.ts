import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { NextRequest } from 'next/server';
import { AuditAction, MetricType } from '@prisma/client';
import ExcelJS from 'exceljs';

let mockSessionUser: any = null;

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockSessionUser) return null;
    return {
      id: mockSessionUser.id,
      userId: mockSessionUser.id,
      name: mockSessionUser.name,
      email: mockSessionUser.email,
      role: mockSessionUser.role,
    };
  }),
  requireAuth: vi.fn(async () => {
    if (!mockSessionUser) throw new Error('UNAUTHORIZED');
    return { id: mockSessionUser.id, role: mockSessionUser.role };
  }),
  requireAdmin: vi.fn(async () => {
    if (!mockSessionUser || mockSessionUser.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
    return { id: mockSessionUser.id, role: 'ADMIN' };
  }),
}));

import { GET as getDailyReport } from '../src/app/api/reports/daily/route';
import { GET as exportDailyReport } from '../src/app/api/reports/daily/export/route';

describe('Daily Report & Export Verification (/api/reports/daily and /api/reports/daily/export)', () => {
  const testDate = '2026-10-20';
  const targetDateObj = new Date(`${testDate}T00:00:00.000Z`);

  let adminUser: any = null;
  let employeeUser: any = null;
  let testSection: any = null;
  let testGroupLink: any = null;

  beforeAll(async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$connect();
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    adminUser = await prisma.user.create({
      data: {
        name: 'Daily Verification Admin',
        email: `daily_admin_${unique}@example.com`,
        password_hash: 'mockhash123',
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: 'সোহাগ মিয়া (Sohag)',
        email: `sohag_${unique}@example.com`,
        password_hash: 'mockhash123',
        role: 'EMPLOYEE',
      },
    });

    testSection = await prisma.groupSection.create({
      data: {
        name: `দৈনিক টেস্ট সেকশন_${unique}`,
      },
    });

    await prisma.assignment.create({
      data: {
        employee_id: employeeUser.id,
        section_id: testSection.id,
        assigned_by: adminUser.id,
      },
    });

    testGroupLink = await prisma.groupLink.create({
      data: {
        title: 'টেস্ট গ্রুপ ১',
        url: 'https://facebook.com/groups/test-daily-verify',
        section_id: testSection.id,
      },
    });

    // Create 3 link completions on testDate (2026-10-20 Dhaka time)
    const completedAtDhaka = new Date('2026-10-20T10:00:00+06:00');
    await prisma.linkCompletion.create({
      data: {
        employee_id: employeeUser.id,
        group_link_id: testGroupLink.id,
        completed_at: completedAtDhaka,
      },
    });

    // Create daily entries for metrics
    await prisma.dailyEntry.createMany({
      data: [
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.SALES_AMOUNT,
          value: 25000,
        },
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.PROFIT_AMOUNT,
          value: 8000,
        },
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.NEW_CLIENTS,
          value: 5,
        },
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.B2B_ORDERS,
          value: 2,
        },
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.RETENTION_COUNT,
          value: 4,
        },
        {
          employee_id: employeeUser.id,
          entry_date: targetDateObj,
          metric_type: MetricType.FOLLOWUPS_DONE,
          value: 10,
        },
      ],
    });

    // Daily reflection text
    await prisma.dailyText.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: targetDateObj,
        main_issue: 'কুরিয়ার ডেলিভারি বিলম্ব ও স্টক স্বল্পতা',
        next_priorities: 'নতুন স্টক আনা ও ৫ জন পুরাতন ক্রেতাকে ফোন করা',
      },
    });
  });

  afterAll(async () => {
    if (adminUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: adminUser.id } });
    }
    if (employeeUser) {
      await prisma.linkCompletion.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyText.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyEntry.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.assignment.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    }
    if (testGroupLink) {
      await prisma.groupLink.deleteMany({ where: { id: testGroupLink.id } });
    }
    if (testSection) {
      await prisma.groupSection.deleteMany({ where: { id: testSection.id } });
    }
    if (adminUser) {
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
  });

  it('rejects unauthenticated or non-admin access to /api/reports/daily', async () => {
    mockSessionUser = null;
    const req1 = new NextRequest(`http://localhost:3000/api/reports/daily?date=${testDate}`);
    const res1 = await getDailyReport(req1);
    expect(res1.status).toBe(403);

    mockSessionUser = { id: employeeUser.id, role: 'EMPLOYEE' };
    const req2 = new NextRequest(`http://localhost:3000/api/reports/daily?date=${testDate}`);
    const res2 = await getDailyReport(req2);
    expect(res2.status).toBe(403);
  });

  it('returns correctly aggregated daily performance metrics for marketers', async () => {
    mockSessionUser = { id: adminUser.id, role: 'ADMIN' };
    const req = new NextRequest(`http://localhost:3000/api/reports/daily?date=${testDate}`);
    const res = await getDailyReport(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.date).toBe(testDate);
    expect(data.summary).toBeDefined();
    expect(data.employees).toBeDefined();

    const empData = data.employees.find((e: any) => e.employee_id === employeeUser.id);
    expect(empData).toBeDefined();
    expect(empData.name).toBe('সোহাগ মিয়া (Sohag)');
    expect(empData.metrics.POSTS_DONE).toBe(1);
    expect(empData.metrics.SALES_AMOUNT).toBe(25000);
    expect(empData.metrics.PROFIT_AMOUNT).toBe(8000);
    expect(empData.metrics.NEW_CLIENTS).toBe(5);
    expect(empData.metrics.B2B_ORDERS).toBe(2);
    expect(empData.metrics.RETENTION_COUNT).toBe(4);
    expect(empData.metrics.FOLLOWUPS_DONE).toBe(10);
    expect(empData.score).toBeDefined();
    expect(empData.daily_text?.main_issue).toBe('কুরিয়ার ডেলিভারি বিলম্ব ও স্টক স্বল্পতা');
    expect(empData.daily_text?.next_priorities).toBe('নতুন স্টক আনা ও ৫ জন পুরাতন ক্রেতাকে ফোন করা');
  });

  it('exports Excel (.xlsx) with valid structure and records audit log', async () => {
    mockSessionUser = { id: adminUser.id, role: 'ADMIN' };
    const req = new NextRequest(`http://localhost:3000/api/reports/daily/export?date=${testDate}&type=excel`);
    const res = await exportDailyReport(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(res.headers.get('Content-Disposition')).toContain(`daily-report-${testDate}.xlsx`);

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const ws = wb.getWorksheet('Daily Report');
    expect(ws).toBeDefined();

    // Verify Audit Log entry
    const audit = await prisma.auditLog.findFirst({
      where: {
        actor_id: adminUser.id,
        action: AuditAction.EXPORT,
        entity: 'DailyReport',
        entity_id: testDate,
      },
      orderBy: { created_at: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.payload).toEqual(expect.objectContaining({ date: testDate, format: 'excel' }));
  });

  it('exports PDF (.pdf) with valid structure and records audit log', async () => {
    mockSessionUser = { id: adminUser.id, role: 'ADMIN' };
    const req = new NextRequest(`http://localhost:3000/api/reports/daily/export?date=${testDate}&type=pdf`);
    const res = await exportDailyReport(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain(`daily-report-${testDate}.pdf`);

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Verify Audit Log entry
    const audit = await prisma.auditLog.findFirst({
      where: {
        actor_id: adminUser.id,
        action: AuditAction.EXPORT,
        entity: 'DailyReport',
        entity_id: testDate,
      },
      orderBy: { created_at: 'desc' },
    });
    expect(audit).not.toBeNull();
  });
});
