import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import {
  getMonthDateRange,
  calculateGrowthPct,
  computeMonthlyAutoData,
} from '../src/lib/reports';
import { hashPassword } from '../src/lib/auth';
import { MonthlyReportStatus, MetricType, PeriodType } from '@prisma/client';

describe('Step 8: Monthly Report Unit & Integration Tests', () => {
  let adminUser: any;
  let employeeUser: any;
  let testSection: any;
  let testProduct: any;
  const testMonth = '2026-08';
  const prevMonth = '2026-07';

  beforeAll(async () => {
    const passwordHash = await hashPassword('MonthAdminPass123!');

    adminUser = await prisma.user.create({
      data: {
        name: 'Monthly Test Admin',
        email: 'monthadmin@test.com',
        password_hash: passwordHash,
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: 'Monthly Test Employee',
        email: 'monthemp@test.com',
        password_hash: passwordHash,
        role: 'EMPLOYEE',
      },
    });

    testSection = await prisma.groupSection.create({
      data: {
        name: 'Monthly Test Section',
        description: 'Testing monthly report section targets',
      },
    });

    await prisma.assignment.create({
      data: {
        employee_id: employeeUser.id,
        section_id: testSection.id,
        assigned_by: adminUser.id,
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name_bn: 'মাসিক টেস্ট পাউডার',
        name_en: 'Monthly Test Powder',
        unit: 'packet',
        selling_price: 500.0,
      },
    });

    // Targets for Section
    await prisma.sectionTarget.create({
      data: {
        section_id: testSection.id,
        metric_type: MetricType.SALES_AMOUNT,
        target_value: 50000.0,
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-08-01T00:00:00Z'),
        period_end: new Date('2026-08-31T23:59:59Z'),
        set_by: adminUser.id,
      },
    });

    await prisma.sectionTarget.create({
      data: {
        section_id: testSection.id,
        metric_type: MetricType.POSTS_DONE,
        target_value: 100.0,
        period_type: PeriodType.MONTHLY,
        period_start: new Date('2026-08-01T00:00:00Z'),
        period_end: new Date('2026-08-31T23:59:59Z'),
        set_by: adminUser.id,
      },
    });

    // Monthly Budget Limit
    await prisma.budgetLimit.create({
      data: {
        scope: 'MONTHLY_TOTAL',
        month: testMonth,
        amount: 25000.0,
        set_by: adminUser.id,
      },
    });

    // Previous Month Entries (2026-07)
    await prisma.dailyEntry.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-07-15T00:00:00Z'),
        metric_type: MetricType.SALES_AMOUNT,
        value: 20000.0,
      },
    });
    await prisma.dailyEntry.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-07-15T00:00:00Z'),
        metric_type: MetricType.PROFIT_AMOUNT,
        value: 5000.0,
      },
    });

    // Current Month Entries (2026-08)
    await prisma.dailyEntry.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-08-10T00:00:00Z'),
        metric_type: MetricType.SALES_AMOUNT,
        value: 40000.0,
      },
    });
    await prisma.dailyEntry.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-08-10T00:00:00Z'),
        metric_type: MetricType.PROFIT_AMOUNT,
        value: 12000.0,
      },
    });
    await prisma.dailyEntry.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-08-10T00:00:00Z'),
        metric_type: MetricType.AD_SPEND,
        value: 8000.0,
      },
    });

    // Daily product sale
    await prisma.dailyProductSale.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date('2026-08-10T00:00:00Z'),
        product_id: testProduct.id,
        quantity: 80,
        amount: 40000.0,
      },
    });

    // Lead for channel breakdown
    await prisma.lead.create({
      data: {
        name: 'মাসিক টেস্ট ক্রেতা',
        phone: '01899112233',
        owner_id: employeeUser.id,
        source_channel: 'FACEBOOK_AD',
        status: 'ORDERED',
        order_amount: 40000.0,
        created_at: new Date('2026-08-12T10:00:00+06:00'),
      },
    });
  });

  afterAll(async () => {
    await prisma.monthlyReport.deleteMany({
      where: { month: testMonth },
    });
    await prisma.budgetLimit.deleteMany({
      where: { month: testMonth },
    });
    await prisma.lead.deleteMany({
      where: { phone: '01899112233' },
    });
    await prisma.dailyProductSale.deleteMany({
      where: { product_id: testProduct?.id },
    });
    await prisma.dailyEntry.deleteMany({
      where: { employee_id: employeeUser?.id },
    });
    await prisma.sectionTarget.deleteMany({
      where: { section_id: testSection?.id },
    });
    await prisma.assignment.deleteMany({
      where: { employee_id: employeeUser?.id },
    });
    if (testProduct) {
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (testSection) {
      await prisma.groupSection.deleteMany({ where: { id: testSection.id } });
    }
    if (employeeUser) {
      await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    }
    if (adminUser) {
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
  });

  it('1. should calculate correct date range and previous month including January rollover', () => {
    const august = getMonthDateRange('2026-08');
    expect(august.monthStr).toBe('2026-08');
    expect(august.prevMonthStr).toBe('2026-07');
    expect(august.startDate.toISOString().slice(0, 10)).toBe('2026-08-01');
    expect(august.endDate.toISOString().slice(0, 10)).toBe('2026-08-31');

    // January to previous year December rollover
    const jan = getMonthDateRange('2026-01');
    expect(jan.monthStr).toBe('2026-01');
    expect(jan.prevMonthStr).toBe('2025-12');
  });

  it('2. should correctly compute MoM growth percentage', () => {
    // 20,000 to 40,000 is 100% growth
    expect(calculateGrowthPct(40000, 20000)).toBe(100);
    // 20,000 to 10,000 is -50%
    expect(calculateGrowthPct(10000, 20000)).toBe(-50);
    // 0 to 500 is 100%
    expect(calculateGrowthPct(500, 0)).toBe(100);
    // 0 to 0 is 0%
    expect(calculateGrowthPct(0, 0)).toBe(0);
  });

  it('3. should generate accurate computeMonthlyAutoData for all 6 sections', async () => {
    const autoData = await computeMonthlyAutoData(testMonth);

    // Section 1: MoM Growth
    expect(autoData.mom_growth.current.sales).toBe(40000);
    expect(autoData.mom_growth.previous.sales).toBe(20000);
    expect(autoData.mom_growth.diff.sales).toBe(20000);
    expect(autoData.mom_growth.growth_pct.sales).toBe(100);

    expect(autoData.mom_growth.current.profit).toBe(12000);
    expect(autoData.mom_growth.previous.profit).toBe(5000);
    expect(autoData.mom_growth.growth_pct.profit).toBe(140);

    // Section 2: Employee Performance Ranking
    const rankedEmp = autoData.employee_rankings.find((e) => e.employee_id === employeeUser.id);
    expect(rankedEmp).toBeDefined();
    expect(rankedEmp?.sales_amount).toBe(40000);
    expect(rankedEmp?.rank).toBeGreaterThanOrEqual(1);

    // Section 3: Budget vs Actual Spend
    expect(autoData.budget_summary.monthly_budget).toBe(25000);
    expect(autoData.budget_summary.actual_spend).toBe(8000);
    expect(autoData.budget_summary.percentage_used).toBe(32);
    expect(autoData.budget_summary.remaining).toBe(17000);

    // Section 4: Section Targets vs Actuals
    const targetSection = autoData.section_achievements.find((s) => s.section_id === testSection.id);
    expect(targetSection).toBeDefined();
    expect(targetSection?.sales_target).toBe(50000);
    expect(targetSection?.sales_actual).toBe(40000);
    expect(targetSection?.sales_pct).toBe(80);

    // Section 5: Top Products
    const topProd = autoData.top_products.find((p) => p.product_id === testProduct.id);
    expect(topProd).toBeDefined();
    expect(topProd?.quantity).toBe(80);
    expect(topProd?.revenue).toBe(40000);

    // Section 6: Channels
    const fbAd = autoData.channel_breakdown.find((c) => c.channel === 'FACEBOOK_AD');
    expect(fbAd).toBeDefined();
    expect(fbAd?.leads_count).toBeGreaterThanOrEqual(1);
    expect(fbAd?.orders_count).toBeGreaterThanOrEqual(1);
    expect(fbAd?.total_amount).toBeGreaterThanOrEqual(40000);
  });

  it('4. should save draft and finalize report with locking', async () => {
    // 1. Create/Save Draft
    const autoData = await computeMonthlyAutoData(testMonth);
    const draft = await prisma.monthlyReport.create({
      data: {
        month: testMonth,
        status: MonthlyReportStatus.DRAFT,
        summary_text: 'আগস্ট মাসের বিক্রয় প্রবৃদ্ধি ১০০% অর্জিত হয়েছে।',
        next_month_goal: 'সেপ্টেম্বর মাসে নতুন ৫ জন পাইকার যুক্ত করা।',
        next_month_budget: 30000.0,
        auto_data: autoData as object,
        created_by: adminUser.id,
      },
    });

    expect(draft.status).toBe(MonthlyReportStatus.DRAFT);
    expect(draft.summary_text).toContain('১০০%');
    expect(draft.finalized_at).toBeNull();

    // 2. Finalize Report
    const finalized = await prisma.monthlyReport.update({
      where: { id: draft.id },
      data: {
        status: MonthlyReportStatus.FINAL,
        finalized_at: new Date(),
      },
    });

    expect(finalized.status).toBe(MonthlyReportStatus.FINAL);
    expect(finalized.finalized_at).not.toBeNull();
  });
});
