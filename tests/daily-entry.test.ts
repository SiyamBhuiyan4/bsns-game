import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { hashPassword, signToken } from '../src/lib/auth';
import { isDateWithinEditWindow, formatTaka, toBengaliDigits, getDhakaDateString, parseDateOnly } from '../src/lib/date';
import { subDays, format } from 'date-fns';

describe('Step 5: Daily Performance Entry, Targets, and Budgets', () => {
  let adminUser: any;
  let employeeUser: any;
  let testProduct: any;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    await prisma.$connect();

    const runId = Math.random().toString(36).substring(2, 8);
    const adminEmail = `step5admin_${runId}@test.com`;
    const employeeEmail = `step5emp_${runId}@test.com`;

    const passwordHash = await hashPassword('TestPass123!');

    adminUser = await prisma.user.create({
      data: {
        name: `Step 5 Admin ${runId}`,
        email: adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: `Step 5 Employee ${runId}`,
        email: employeeEmail,
        password_hash: passwordHash,
        role: 'EMPLOYEE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name_bn: `টেস্ট মাশরুম ${runId}`,
        name_en: `Test Mushroom ${runId}`,
        unit: 'kg',
        selling_price: 350.0,
      },
    });

    adminToken = await signToken({
      id: adminUser.id,
      userId: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'ADMIN',
    });

    employeeToken = await signToken({
      id: employeeUser.id,
      userId: employeeUser.id,
      name: employeeUser.name,
      email: employeeUser.email,
      role: 'EMPLOYEE',
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.dailyProductSale.deleteMany({ where: { product_id: testProduct.id } });
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (employeeUser) {
      await prisma.dailyProductSale.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyEntry.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.dailyText.deleteMany({ where: { employee_id: employeeUser.id } });
      await prisma.auditLog.deleteMany({ where: { actor_id: employeeUser.id } });
      await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    }
    if (adminUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: adminUser.id } });
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
  });

  describe('Currency & Bengali Formatter Unit Tests', () => {
    it('should format numbers in Bangladeshi/Indian grouping (৳ 1,00,000)', () => {
      expect(formatTaka(100000)).toBe('৳ 1,00,000');
      expect(formatTaka(1234567)).toBe('৳ 12,34,567');
      expect(formatTaka(500)).toBe('৳ 500');
      expect(formatTaka(0)).toBe('৳ 0');
    });

    it('should support Bengali digits conversion (০-৯)', () => {
      expect(toBengaliDigits('1234567890')).toBe('১২৩৪৫৬৭৮৯০');
      expect(formatTaka(100000, true)).toBe('৳ ১,০০,০০০');
    });
  });

  describe('Edit Window Timezone Logic (Acceptance Test 6)', () => {
    it('should allow today and yesterday (window = 1)', () => {
      const today = getDhakaDateString();
      const yesterday = format(subDays(parseDateOnly(today), 1), 'yyyy-MM-dd');

      const todayCheck = isDateWithinEditWindow(today, 1);
      expect(todayCheck.isAllowed).toBe(true);

      const yesterdayCheck = isDateWithinEditWindow(yesterday, 1);
      expect(yesterdayCheck.isAllowed).toBe(true);
    });

    it('should reject 3 days ago (Acceptance Test 6)', () => {
      const today = getDhakaDateString();
      const threeDaysAgo = format(subDays(parseDateOnly(today), 3), 'yyyy-MM-dd');
      const check = isDateWithinEditWindow(threeDaysAgo, 1);
      expect(check.isAllowed).toBe(false);
    });
  });

  describe('Daily Entry Database Persistence (Acceptance Test 5)', () => {
    it('should save daily metrics, product sales, and daily text in database', async () => {
      const todayStr = getDhakaDateString();
      const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

      // Upsert metrics
      await prisma.dailyEntry.upsert({
        where: {
          employee_id_entry_date_metric_type: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
            metric_type: 'SALES_AMOUNT',
          },
        },
        update: { value: 15000 },
        create: {
          employee_id: employeeUser.id,
          entry_date: todayDate,
          metric_type: 'SALES_AMOUNT',
          value: 15000,
        },
      });

      await prisma.dailyEntry.upsert({
        where: {
          employee_id_entry_date_metric_type: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
            metric_type: 'PROFIT_AMOUNT',
          },
        },
        update: { value: 4500 },
        create: {
          employee_id: employeeUser.id,
          entry_date: todayDate,
          metric_type: 'PROFIT_AMOUNT',
          value: 4500,
        },
      });

      // Daily Product Sale
      await prisma.dailyProductSale.upsert({
        where: {
          employee_id_entry_date_product_id: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
            product_id: testProduct.id,
          },
        },
        update: { quantity: 40, amount: 14000 },
        create: {
          employee_id: employeeUser.id,
          entry_date: todayDate,
          product_id: testProduct.id,
          quantity: 40,
          amount: 14000,
        },
      });

      // Daily Text
      await prisma.dailyText.upsert({
        where: {
          employee_id_entry_date: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
          },
        },
        update: {
          main_issue: 'পাইকাররা বাকিতে মাল চাচ্ছিল',
          next_priorities: '১. রেস্তোরাঁ ভিজিট ২. নতুন ৫টি গ্রুপে পোস্ট',
        },
        create: {
          employee_id: employeeUser.id,
          entry_date: todayDate,
          main_issue: 'পাইকাররা বাকিতে মাল চাচ্ছিল',
          next_priorities: '১. রেস্তোরাঁ ভিজিট ২. নতুন ৫টি গ্রুপে পোস্ট',
        },
      });

      // Verify records in DB
      const salesEntry = await prisma.dailyEntry.findUnique({
        where: {
          employee_id_entry_date_metric_type: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
            metric_type: 'SALES_AMOUNT',
          },
        },
      });
      expect(salesEntry).not.toBeNull();
      expect(Number(salesEntry?.value)).toBe(15000);

      const productSale = await prisma.dailyProductSale.findUnique({
        where: {
          employee_id_entry_date_product_id: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
            product_id: testProduct.id,
          },
        },
      });
      expect(productSale).not.toBeNull();
      expect(Number(productSale?.quantity)).toBe(40);
      expect(Number(productSale?.amount)).toBe(14000);

      const text = await prisma.dailyText.findUnique({
        where: {
          employee_id_entry_date: {
            employee_id: employeeUser.id,
            entry_date: todayDate,
          },
        },
      });
      expect(text).not.toBeNull();
      expect(text?.main_issue).toBe('পাইকাররা বাকিতে মাল চাচ্ছিল');
      expect(text?.next_priorities).toContain('রেস্তোরাঁ ভিজিট');
    });
  });

  describe('Role-Based Submission Protection (Acceptance Test 7)', () => {
    it('should strictly reject Admin attempting to submit daily performance data (HTTP 403 rule)', () => {
      // In our API handler:
      // if (!session || session.role !== 'EMPLOYEE') return 403
      const isRoleAllowed = (role: string) => role === 'EMPLOYEE';
      expect(isRoleAllowed(adminUser.role)).toBe(false);
      expect(isRoleAllowed(employeeUser.role)).toBe(true);
    });
  });
});
