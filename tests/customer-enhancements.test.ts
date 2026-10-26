import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { NextRequest } from 'next/server';
import { formatBstDateTime, getDhakaDateString, getDhakaStartOfDay, getDhakaEndOfDay } from '../src/lib/date';

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
}));

import { GET as checkPhone } from '../src/app/api/leads/check-phone/route';
import { GET as getLeads, POST as createLead } from '../src/app/api/leads/route';
import { PUT as updateEmployee } from '../src/app/api/admin/employees/[id]/route';

describe('Customer & Lead System Enhancements (BST Dates, Phone Uniqueness, Database Permissions)', () => {
  const runId = Math.random().toString(36).substring(2, 9);

  let adminUser: any;
  let employeeA: any;
  let employeeB: any;
  let leadA: any;

  const phoneA = '01711' + Math.floor(100000 + Math.random() * 900000);
  const phoneB = '01822' + Math.floor(100000 + Math.random() * 900000);

  beforeAll(async () => {
    await prisma.$connect();

    adminUser = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: `admin_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'ADMIN',
      },
    });

    employeeA = await prisma.user.create({
      data: {
        name: 'Employee Alpha',
        email: `emp_a_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'EMPLOYEE',
        can_view_all_customers: false,
      },
    });

    employeeB = await prisma.user.create({
      data: {
        name: 'Employee Beta',
        email: `emp_b_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'EMPLOYEE',
        can_view_all_customers: false,
      },
    });

    // Create a customer lead for Employee A
    leadA = await prisma.lead.create({
      data: {
        name: 'Rahim Traders',
        phone: phoneA,
        source_channel: 'ফেসবুক পেজ',
        owner_id: employeeA.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({
      where: { phone: { in: [phoneA, phoneB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, employeeA.id, employeeB.id] } },
    });
    await prisma.$disconnect();
  });

  // 1. Live Phone Check Endpoint
  describe('Requirement 1: Phone Uniqueness & Live Check Endpoint', () => {
    it('returns exists: false and valid: true for a new phone number', async () => {
      mockSessionUser.id = employeeA.id;
      mockSessionUser.userId = employeeA.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest(`http://localhost:3000/api/leads/check-phone?phone=${phoneB}`);
      const res = await checkPhone(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.exists).toBe(false);
      expect(data.valid).toBe(true);
    });

    it('returns exists: true with leadName and ownerName for an existing customer phone', async () => {
      mockSessionUser.id = employeeB.id;
      mockSessionUser.userId = employeeB.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest(`http://localhost:3000/api/leads/check-phone?phone=${phoneA}`);
      const res = await checkPhone(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.leadName).toBe('Rahim Traders');
      expect(data.ownerName).toBe('Employee Alpha');
    });

    it('POST /api/leads blocks creation if phone number already exists', async () => {
      mockSessionUser.id = employeeB.id;
      mockSessionUser.userId = employeeB.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Rahim',
          phone: phoneA,
          source_channel: 'ওয়েবসাইট',
        }),
      });

      const res = await createLead(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        'এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার)। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।'
      );
    });

    it('POST /api/leads succeeds for a brand new unique customer phone', async () => {
      mockSessionUser.id = employeeB.id;
      mockSessionUser.userId = employeeB.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Customer Karim',
          phone: phoneB,
          source_channel: 'ফেসবুক বিজ্ঞাপন',
        }),
      });

      const res = await createLead(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.lead.name).toBe('New Customer Karim');
      expect(data.lead.phone).toBe(phoneB);
    });
  });

  // 2. BST Date & Time
  describe('Requirement 2: Automatic BST Date & Time', () => {
    it('formats UTC ISO timestamp to BST (UTC+6) correctly', () => {
      // 12:00 UTC = 18:00 (06:00 PM) BST
      const utcIso = '2026-10-26T12:00:00.000Z';
      const bstDisplayEn = formatBstDateTime(utcIso, 'en');
      expect(bstDisplayEn).toContain('06:00 PM');
      expect(bstDisplayEn).toContain('(BST)');

      const bstDisplayBn = formatBstDateTime(utcIso, 'bn');
      expect(bstDisplayBn).toContain('(BST)');
    });

    it('leads list returns created_at_bst and created_at_bst_en', async () => {
      mockSessionUser.id = adminUser.id;
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.role = 'ADMIN';

      const req = new NextRequest('http://localhost:3000/api/leads');
      const res = await getLeads(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      const leadItem = data.leads.find((l: any) => l.phone === phoneA);
      expect(leadItem).toBeDefined();
      expect(leadItem.created_at_bst).toBeDefined();
      expect(leadItem.created_at_bst).toContain('(BST)');
    });
  });

  // 3. Employee Role-Based Customer Database Access
  describe('Requirement 4 & 5: Employee Role-Based Access & Admin Permission Toggle', () => {
    it('Employee without permission sees ONLY their own customers', async () => {
      mockSessionUser.id = employeeA.id;
      mockSessionUser.userId = employeeA.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost:3000/api/leads');
      const res = await getLeads(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.can_view_all_customers).toBe(false);

      const phones = data.leads.map((l: any) => l.phone || l.masked_phone);
      // Lead A belongs to Employee A, Lead B belongs to Employee B
      expect(data.leads.some((l: any) => l.name === 'Rahim Traders')).toBe(true);
      expect(data.leads.some((l: any) => l.name === 'New Customer Karim')).toBe(false);
    });

    it('Admin can toggle can_view_all_customers for an employee via PUT /api/admin/employees/[id]', async () => {
      mockSessionUser.id = adminUser.id;
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.role = 'ADMIN';

      const req = new NextRequest(`http://localhost:3000/api/admin/employees/${employeeA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          can_view_all_customers: true,
        }),
      });

      const res = await updateEmployee(req, { params: Promise.resolve({ id: employeeA.id }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.employee.can_view_all_customers).toBe(true);

      const updatedUser = await prisma.user.findUnique({ where: { id: employeeA.id } });
      expect(updatedUser?.can_view_all_customers).toBe(true);
    });

    it('Employee with can_view_all_customers: true now sees the full customer database', async () => {
      mockSessionUser.id = employeeA.id;
      mockSessionUser.userId = employeeA.id;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost:3000/api/leads');
      const res = await getLeads(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.can_view_all_customers).toBe(true);

      // Now Employee A can see both Rahim Traders and New Customer Karim
      expect(data.leads.some((l: any) => l.name === 'Rahim Traders')).toBe(true);
      expect(data.leads.some((l: any) => l.name === 'New Customer Karim')).toBe(true);
    });
  });

  // 4. Calendar & Date Filter Presets
  describe('Requirement 3: Date Filter Presets (1d, 3d, 7d, 30d, all, custom)', () => {
    it('filters today leads using period=1d', async () => {
      mockSessionUser.id = adminUser.id;
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.role = 'ADMIN';

      const req = new NextRequest('http://localhost:3000/api/leads?period=1d');
      const res = await getLeads(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Both leads were created today
      expect(data.leads.length).toBeGreaterThanOrEqual(2);
    });

    it('supports period=3d, 7d, 30d, all', async () => {
      mockSessionUser.id = adminUser.id;
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.role = 'ADMIN';

      for (const p of ['3d', '7d', '30d', 'all']) {
        const req = new NextRequest(`http://localhost:3000/api/leads?period=${p}`);
        const res = await getLeads(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.leads).toBeDefined();
      }
    });

    it('supports custom calendar date range (startDate & endDate)', async () => {
      mockSessionUser.id = adminUser.id;
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.role = 'ADMIN';

      const todayStr = getDhakaDateString();
      const req = new NextRequest(`http://localhost:3000/api/leads?startDate=${todayStr}&endDate=${todayStr}`);
      const res = await getLeads(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.leads.length).toBeGreaterThanOrEqual(2);
    });
  });
});
