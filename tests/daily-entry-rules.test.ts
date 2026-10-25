import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { NextRequest } from 'next/server';
import { subDays, format } from 'date-fns';
import { getDhakaDateString, parseDateOnly } from '../src/lib/date';
import {
  checkDailyEntryWarnings,
  WARNING_MESSAGES,
  LOCK_NOTICE,
  SAVE_SUCCESS_MESSAGE,
} from '../src/lib/daily-entry';

// Mock session
const mockSessionUser = {
  id: '',
  userId: '',
  name: '',
  email: '',
  role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockSessionUser.userId) return null;
    return { ...mockSessionUser };
  }),
}));

import { GET as dailyEntryGET, POST as dailyEntryPOST } from '../src/app/api/employee/daily-entry/route';

describe('Employee Daily Entry Form & Business Logic Auditing (Section 7.2)', () => {
  let adminUser: any;
  let employeeUser: any;
  let testProduct: any;

  beforeAll(async () => {
    await prisma.$connect();
    const runId = Math.random().toString(36).substring(2, 8);
    const dummyPasswordHash = '$2a$12$e80yq9N0k8l8M9v5.XmYmOG6rM9V6Y.N.O1J2K3L4M5N6O7P8Q9R';

    adminUser = await prisma.user.create({
      data: {
        name: `DailyEntry Admin ${runId}`,
        email: `de_admin_${runId}@test.com`,
        password_hash: dummyPasswordHash,
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: `DailyEntry Employee ${runId}`,
        email: `de_emp_${runId}@test.com`,
        password_hash: dummyPasswordHash,
        role: 'EMPLOYEE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name_bn: 'অরগানিক মাশরুম',
        name_en: 'Organic Mushroom',
        unit: 'kg',
        selling_price: 400.0,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.dailyProductSale.deleteMany({ where: { product_id: testProduct.id } });
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (employeeUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: employeeUser.id } });
      await prisma.dailyProductSale.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyEntry.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyText.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    }
    if (adminUser) {
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
  });

  beforeEach(async () => {
    mockSessionUser.userId = employeeUser.id;
    mockSessionUser.id = employeeUser.id;
    mockSessionUser.role = 'EMPLOYEE';
    mockSessionUser.name = employeeUser.name;
    mockSessionUser.email = employeeUser.email;

    // Ensure default edit window is 1 day for test isolation
    await prisma.scoringSettings.upsert({
      where: { id: 'default' },
      update: { employee_edit_window_days: 1 },
      create: {
        id: 'default',
        section_weights: {},
        employee_edit_window_days: 1,
      },
    });
  });

  describe('1. Business Warnings (Section 7.2)', () => {
    it('should trigger Profit > Sales warning when profit exceeds sales', () => {
      const warnings = checkDailyEntryWarnings({
        SALES_AMOUNT: 5000,
        PROFIT_AMOUNT: 7000,
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('PROFIT_EXCEEDS_SALES');
      expect(warnings[0].message).toBe('সতর্কতা: লাভের পরিমাণ মোট বিক্রির চেয়ে বেশি।');
    });

    it('should NOT trigger Profit > Sales warning when profit is less than or equal to sales', () => {
      const warnings = checkDailyEntryWarnings({
        SALES_AMOUNT: 10000,
        PROFIT_AMOUNT: 3000,
      });
      expect(warnings.find((w) => w.code === 'PROFIT_EXCEEDS_SALES')).toBeUndefined();
    });

    it('should trigger Confirmed Orders > New Leads warning', () => {
      const warnings = checkDailyEntryWarnings({
        CONFIRMED_ORDERS: 15,
        NEW_LEADS: 10,
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('ORDERS_EXCEED_LEADS');
      expect(warnings[0].message).toBe('সতর্কতা: নিশ্চিত অর্ডারের সংখ্যা নতুন লিডের চেয়ে বেশি।');
    });

    it('should NOT trigger Confirmed Orders > New Leads when orders <= leads', () => {
      const warnings = checkDailyEntryWarnings({
        CONFIRMED_ORDERS: 8,
        NEW_LEADS: 12,
      });
      expect(warnings.find((w) => w.code === 'ORDERS_EXCEED_LEADS')).toBeUndefined();
    });

    it('should trigger B2B Orders > B2B Inquiries warning', () => {
      const warnings = checkDailyEntryWarnings({
        B2B_ORDERS: 5,
        B2B_INQUIRIES: 2,
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].code).toBe('B2B_ORDERS_EXCEED_INQUIRIES');
      expect(warnings[0].message).toBe('সতর্কতা: B2B অর্ডারের সংখ্যা B2B অনুসন্ধানের চেয়ে বেশি।');
    });

    it('should NOT trigger B2B warning when B2B orders <= inquiries', () => {
      const warnings = checkDailyEntryWarnings({
        B2B_ORDERS: 3,
        B2B_INQUIRIES: 5,
      });
      expect(warnings.find((w) => w.code === 'B2B_ORDERS_EXCEED_INQUIRIES')).toBeUndefined();
    });

    it('should trigger all 3 warnings simultaneously when all conditions are violated', () => {
      const warnings = checkDailyEntryWarnings({
        SALES_AMOUNT: 1000,
        PROFIT_AMOUNT: 2000,
        CONFIRMED_ORDERS: 10,
        NEW_LEADS: 2,
        B2B_ORDERS: 6,
        B2B_INQUIRIES: 1,
      });

      expect(warnings).toHaveLength(3);
      const messages = warnings.map((w) => w.message);
      expect(messages).toContain('সতর্কতা: লাভের পরিমাণ মোট বিক্রির চেয়ে বেশি।');
      expect(messages).toContain('সতর্কতা: নিশ্চিত অর্ডারের সংখ্যা নতুন লিডের চেয়ে বেশি।');
      expect(messages).toContain('সতর্কতা: B2B অর্ডারের সংখ্যা B2B অনুসন্ধানের চেয়ে বেশি।');
    });
  });

  describe('2. Lock Window Enforcement (Section 7.2)', () => {
    it('should allow employee to edit today and yesterday', async () => {
      const today = getDhakaDateString();
      const reqToday = new NextRequest(`http://localhost/api/employee/daily-entry?date=${today}`);
      const resToday = await dailyEntryGET(reqToday);

      expect(resToday.status).toBe(200);
      const dataToday = await resToday.json();
      expect(dataToday.is_locked).toBe(false);
      expect(dataToday.can_edit).toBe(true);

      const yesterday = format(subDays(parseDateOnly(today), 1), 'yyyy-MM-dd');
      const reqYest = new NextRequest(`http://localhost/api/employee/daily-entry?date=${yesterday}`);
      const resYest = await dailyEntryGET(reqYest);

      expect(resYest.status).toBe(200);
      const dataYest = await resYest.json();
      expect(dataYest.is_locked).toBe(false);
      expect(dataYest.can_edit).toBe(true);
    });

    it('should return locked notice and disabled can_edit for dates older than window', async () => {
      const today = getDhakaDateString();
      const olderDate = format(subDays(parseDateOnly(today), 4), 'yyyy-MM-dd');
      const req = new NextRequest(`http://localhost/api/employee/daily-entry?date=${olderDate}`);
      const res = await dailyEntryGET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_locked).toBe(true);
      expect(data.can_edit).toBe(false);
      expect(data.lock_notice).toBe(LOCK_NOTICE);
      expect(data.lock_notice).toBe('এই তারিখের entry এখন বন্ধ (Locked)।');
    });

    it('should strictly return 403 Forbidden when trying to save older dates', async () => {
      const today = getDhakaDateString();
      const olderDate = format(subDays(parseDateOnly(today), 3), 'yyyy-MM-dd');
      const req = new NextRequest('http://localhost/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: olderDate,
          metrics: {
            SALES_AMOUNT: 5000,
            PROFIT_AMOUNT: 1500,
            CONFIRMED_ORDERS: 5,
            NEW_LEADS: 10,
            NEW_CLIENTS: 3,
            RETENTION_COUNT: 2,
            AD_SPEND: 500,
            FOLLOWUPS_DONE: 15,
            B2B_ORDERS: 1,
            B2B_INQUIRIES: 2,
            B2B_INQUIRY_VALUE: 20000,
          },
        }),
      });

      const res = await dailyEntryPOST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('এই তারিখের entry এখন বন্ধ (Locked)।');
    });
  });

  describe('3. Admin Prohibition (Section 7.2)', () => {
    it('should strictly return 403 when Admin tries to open/GET employee daily entry form', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.role = 'ADMIN';
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;

      const req = new NextRequest('http://localhost/api/employee/daily-entry');
      const res = await dailyEntryGET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.is_admin_forbidden).toBe(true);
      expect(json.error).toContain('অ্যাডমিন');
    });

    it('should strictly return 403 when Admin tries to submit/POST employee daily entry form', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.role = 'ADMIN';
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;

      const today = getDhakaDateString();
      const req = new NextRequest('http://localhost/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: today,
          metrics: {
            SALES_AMOUNT: 12000,
            PROFIT_AMOUNT: 3500,
            CONFIRMED_ORDERS: 4,
            NEW_LEADS: 8,
            NEW_CLIENTS: 2,
            RETENTION_COUNT: 1,
            AD_SPEND: 400,
            FOLLOWUPS_DONE: 10,
            B2B_ORDERS: 0,
            B2B_INQUIRIES: 1,
            B2B_INQUIRY_VALUE: 5000,
          },
        }),
      });

      const res = await dailyEntryPOST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });
  });

  describe('4. Save & Re-save with Audit Logging (Section 7.2)', () => {
    it('should successfully save daily entry, return "সংরক্ষিত হয়েছে (Saved)", and write AuditLog', async () => {
      const today = getDhakaDateString();

      const payload = {
        entry_date: today,
        metrics: {
          SALES_AMOUNT: 20000,
          PROFIT_AMOUNT: 6000,
          CONFIRMED_ORDERS: 8,
          NEW_LEADS: 15,
          NEW_CLIENTS: 5,
          RETENTION_COUNT: 3,
          AD_SPEND: 800,
          FOLLOWUPS_DONE: 25,
          B2B_ORDERS: 2,
          B2B_INQUIRIES: 4,
          B2B_INQUIRY_VALUE: 35000,
        },
        product_sales: [
          {
            product_id: testProduct.id,
            quantity: 50,
            amount: 20000,
          },
        ],
        daily_text: {
          main_issue: 'কাস্টমারদের ডেলিভারি সময় নিয়ে জিজ্ঞাসা ছিল',
          next_priorities: '১. নতুন ৫টি রেস্তোরাঁয় মাশরুমের স্যাম্পল পাঠানো',
        },
        metric_notes: {
          SALES_AMOUNT: 'বসুন্ধরা শাখার পাইকার থেকে বড় পেমেন্ট',
          AD_SPEND: 'ফেসবুক ক্যাম্পেইন বুস্ট',
        },
      };

      const req = new NextRequest('http://localhost/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await dailyEntryPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('সংরক্ষিত হয়েছে (Saved)');

      // Verify AuditLog written
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actor_id: employeeUser.id,
          action: 'ENTRY_SAVE',
          entity: 'DailyEntry',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      const auditPayload = auditLog?.payload as any;
      expect(auditPayload.entry_date).toBe(today);
      expect(auditPayload.new_values).toBeDefined();
      expect(auditPayload.new_values.metrics.SALES_AMOUNT).toBe(20000);
      expect(auditPayload.new_values.metrics.CONFIRMED_ORDERS).toBe(8);
      expect(auditPayload.new_values.metric_notes.SALES_AMOUNT).toBe('বসুন্ধরা শাখার পাইকার থেকে বড় পেমেন্ট');
    });

    it('should update existing rows on re-save and write AuditLog with old and new values', async () => {
      const today = getDhakaDateString();

      // Second save (re-save) with modified values
      const updatedPayload = {
        entry_date: today,
        metrics: {
          SALES_AMOUNT: 25000, // updated from 20000
          PROFIT_AMOUNT: 7500, // updated from 6000
          CONFIRMED_ORDERS: 10, // updated from 8
          NEW_LEADS: 18,
          NEW_CLIENTS: 6,
          RETENTION_COUNT: 4,
          AD_SPEND: 1000,
          FOLLOWUPS_DONE: 30,
          B2B_ORDERS: 3,
          B2B_INQUIRIES: 5,
          B2B_INQUIRY_VALUE: 45000,
        },
        product_sales: [
          {
            product_id: testProduct.id,
            quantity: 62.5,
            amount: 25000,
          },
        ],
        daily_text: {
          main_issue: 'আপডেটেড সমস্যা: কিছু পাইকার বাকিতে অর্ডার চেয়েছিল',
          next_priorities: '১. বকেয়া আদায় ২. নতুন লিড যোগাযোগ',
        },
        metric_notes: {
          SALES_AMOUNT: 'আপডেটেড নোট: অতিরিক্ত ৫০০০ টাকা ক্যাশ বিক্রয়',
        },
      };

      const req = new NextRequest('http://localhost/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload),
      });

      const res = await dailyEntryPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('সংরক্ষিত হয়েছে (Saved)');

      // Verify DB has only 1 entry for this metric (re-saving updated, did not duplicate)
      const parsedDate = parseDateOnly(today);
      const salesEntries = await prisma.dailyEntry.findMany({
        where: {
          employee_id: employeeUser.id,
          entry_date: parsedDate,
          metric_type: 'SALES_AMOUNT',
        },
      });
      expect(salesEntries).toHaveLength(1);
      expect(Number(salesEntries[0].value)).toBe(25000);
      expect(salesEntries[0].note).toBe('আপডেটেড নোট: অতিরিক্ত ৫০০০ টাকা ক্যাশ বিক্রয়');

      // Verify AuditLog captured both old and new values
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actor_id: employeeUser.id,
          action: 'ENTRY_SAVE',
          entity: 'DailyEntry',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      const auditPayload = auditLog?.payload as any;
      expect(auditPayload.old_values).toBeDefined();
      expect(auditPayload.new_values).toBeDefined();
      // Old value should be 20000
      expect(auditPayload.old_values.metrics.SALES_AMOUNT.value).toBe(20000);
      // New value should be 25000
      expect(auditPayload.new_values.metrics.SALES_AMOUNT).toBe(25000);
    });
  });
});
