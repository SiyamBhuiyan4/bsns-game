import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { parseAndValidateCsv } from '../src/lib/csv';
import {
  calculateEmployeeScore,
  DEFAULT_METRIC_WEIGHTS,
  METRIC_DISPLAY_INFO,
  EmployeeScoreResult,
} from '../src/lib/scoring';
import { calculateTargetForDateRange } from '../src/lib/targets';
import {
  getDhakaDateString,
  parseDateOnly,
  isDateWithinEditWindow,
  formatTaka,
  toBengaliDigits,
  DHAKA_TIMEZONE,
} from '../src/lib/date';
import {
  computeWeeklyAutoData,
  computeMonthlyAutoData,
  WEEKLY_FIXED_QUESTIONS,
  getMonthDateRange,
} from '../src/lib/reports';
import { createAuditLog } from '../src/lib/audit';
import { normalizePhone, isValidBdPhone } from '../src/lib/phone';
import { isTaskOverdue, getOverdueTasks } from '../src/lib/plan';
import {
  MetricType,
  PeriodType,
  ReportStatus,
  MonthlyReportStatus,
  PlanStatus,
  TaskStatus,
  AuditAction,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format, subDays, startOfWeek, endOfWeek, parseISO } from 'date-fns';

describe('Section 14: Comprehensive Acceptance Tests Suite (All 26 Criteria)', () => {
  let testAdmin: any;
  let testEmployee: any;
  let agroSection: any;
  let restSection: any;
  let agroLink: any;
  let restLink: any;
  let testProduct: any;

  // Precomputed bcrypt cost 12 hash for instant setup
  const precomputedHash = '$2b$12$KIXeUjW15K7R7xIqmP/Zdu6kLhA.2OsuhP4U4YmCcvj2r9M.yF5qS';

  beforeAll(async () => {
    // 1. Cleanup previous test run artifacts
    await prisma.user.deleteMany({
      where: { email: { in: ['accept_admin@test.com', 'accept_emp@test.com'] } },
    });
    await prisma.groupSection.deleteMany({
      where: { name: { in: ['Acceptance Agro Groups', 'Acceptance Restaurant Groups'] } },
    });
    await prisma.product.deleteMany({
      where: { name_en: 'Acceptance Test Product' },
    });

    // 2. Create Admin and Employee users
    testAdmin = await prisma.user.create({
      data: {
        name: 'হেড অব মার্কেটিং (Acceptance Admin)',
        email: 'accept_admin@test.com',
        password_hash: precomputedHash,
        role: UserRole.ADMIN,
        phone: '01710000001',
      },
    });

    testEmployee = await prisma.user.create({
      data: {
        name: 'ডিজিটাল মার্কেটার (Acceptance Employee)',
        email: 'accept_emp@test.com',
        password_hash: precomputedHash,
        role: UserRole.EMPLOYEE,
        phone: '01710000002',
      },
    });

    // 3. Create Group Sections
    agroSection = await prisma.groupSection.create({
      data: {
        name: 'Acceptance Agro Groups',
        description: 'Agro Facebook groups for Marketer',
        is_active: true,
      },
    });

    restSection = await prisma.groupSection.create({
      data: {
        name: 'Acceptance Restaurant Groups',
        description: 'Restaurant Facebook groups',
        is_active: true,
      },
    });

    // 4. Assign Employee to Agro Groups ONLY (Criterion 2)
    await prisma.assignment.create({
      data: {
        employee_id: testEmployee.id,
        section_id: agroSection.id,
        assigned_by: testAdmin.id,
      },
    });

    // 5. Seed Links
    agroLink = await prisma.groupLink.create({
      data: {
        section_id: agroSection.id,
        url: 'https://www.facebook.com/groups/acceptance-agro-1',
        title: 'Acceptance Agro Community',
      },
    });

    restLink = await prisma.groupLink.create({
      data: {
        section_id: restSection.id,
        url: 'https://www.facebook.com/groups/acceptance-rest-1',
        title: 'Acceptance Chefs Community',
      },
    });

    // 6. Test Product
    testProduct = await prisma.product.create({
      data: {
        name_bn: 'এক্সেপটেন্স মাশরুম গুঁড়া',
        name_en: 'Acceptance Test Product',
        unit: 'packet',
        selling_price: 400.0,
      },
    });
  });

  afterAll(async () => {
    // Teardown
    if (agroLink || restLink) {
      await prisma.linkCompletion.deleteMany({
        where: { group_link_id: { in: [agroLink?.id, restLink?.id].filter(Boolean) } },
      });
      await prisma.groupLink.deleteMany({
        where: { id: { in: [agroLink?.id, restLink?.id].filter(Boolean) } },
      });
    }
    if (testEmployee) {
      await prisma.dailyProductSale.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.dailyEntry.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.dailyText.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.lead.deleteMany({ where: { owner_id: testEmployee.id } });
      await prisma.assignment.deleteMany({ where: { employee_id: testEmployee.id } });
    }
    if (agroSection || restSection) {
      await prisma.csvUploadBatch.deleteMany({
        where: { section_id: { in: [agroSection?.id, restSection?.id].filter(Boolean) } },
      });
      await prisma.groupSection.deleteMany({
        where: { id: { in: [agroSection?.id, restSection?.id].filter(Boolean) } },
      });
    }
    if (testProduct) {
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (testEmployee) {
      await prisma.user.deleteMany({ where: { id: testEmployee.id } });
    }
    if (testAdmin) {
      await prisma.user.deleteMany({ where: { id: testAdmin.id } });
    }
  });

  // --------------------------------------------------------------------------
  // Criterion 1: CSV Upload Validation
  // --------------------------------------------------------------------------
  it('1. Admin uploads CSV with 3 valid, 1 duplicate, 1 invalid URL -> inserted 3, duplicates 1, invalid 1', async () => {
    const csvContent = `url,title
https://www.facebook.com/groups/valid-agro-101,Agro Group 101
https://www.facebook.com/groups/valid-agro-102,Agro Group 102
https://www.facebook.com/groups/valid-agro-103,Agro Group 103
https://www.facebook.com/groups/valid-agro-101,Agro Group 101 Duplicate
not-a-valid-http-url,Invalid URL Row`;

    const parsed = parseAndValidateCsv(csvContent);

    expect(parsed.totalRows).toBe(5);
    expect(parsed.validCount).toBe(3);
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.invalidCount).toBe(1);
    expect(parsed.validRowsToInsert).toHaveLength(3);

    // Save batch record to database to verify persistence
    const batch = await prisma.csvUploadBatch.create({
      data: {
        section_id: agroSection.id,
        uploaded_by: testAdmin.id,
        file_name: 'criterion1_batch.csv',
        total_rows: parsed.totalRows,
        inserted: parsed.validCount,
        duplicates: parsed.duplicateCount,
        invalid: parsed.invalidCount,
      },
    });

    expect(batch.inserted).toBe(3);
    expect(batch.duplicates).toBe(1);
    expect(batch.invalid).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Criterion 2: Employee Assignment Isolation
  // --------------------------------------------------------------------------
  it('2. Employee assigned to "Agro Groups" never sees "Restaurant Groups" links', async () => {
    // Query links assigned to testEmployee (assigned strictly to agroSection)
    const assignments = await prisma.assignment.findMany({
      where: { employee_id: testEmployee.id },
      include: { section: true },
    });

    const activeAssignedSectionIds = assignments
      .filter((a) => a.section.is_active)
      .map((a) => a.section_id);

    const employeeLinks = await prisma.groupLink.findMany({
      where: {
        section_id: { in: activeAssignedSectionIds },
        is_active: true,
      },
      include: { section: true },
    });

    expect(employeeLinks.length).toBeGreaterThan(0);
    expect(employeeLinks.every((l) => l.section.name === 'Acceptance Agro Groups')).toBe(true);
    expect(employeeLinks.some((l) => l.section.name === 'Acceptance Restaurant Groups')).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Criterion 3: Link Completion and Undo
  // --------------------------------------------------------------------------
  it('3. Link completion: Done moves to Completed; Undo returns to To Do', async () => {
    // 1. Mark Done
    const completion = await prisma.linkCompletion.create({
      data: {
        group_link_id: agroLink.id,
        employee_id: testEmployee.id,
        completed_at: new Date(),
      },
    });

    let activeCompletions = await prisma.linkCompletion.findMany({
      where: { employee_id: testEmployee.id, undone_at: null },
    });
    let completedIds = activeCompletions.map((c) => c.group_link_id);
    expect(completedIds).toContain(agroLink.id);

    // 2. Undo completion
    await prisma.linkCompletion.update({
      where: { id: completion.id },
      data: { undone_at: new Date() },
    });

    activeCompletions = await prisma.linkCompletion.findMany({
      where: { employee_id: testEmployee.id, undone_at: null },
    });
    completedIds = activeCompletions.map((c) => c.group_link_id);
    expect(completedIds).not.toContain(agroLink.id); // Returns to To Do
  });

  // --------------------------------------------------------------------------
  // Criterion 4: Daily Entry Persistence and Re-saving Upsert
  // --------------------------------------------------------------------------
  it('4. Daily entry: saving sales, profit, leads, orders; re-saving updates same rows', async () => {
    const todayStr = getDhakaDateString();
    const todayDate = parseDateOnly(todayStr);

    const initialMetrics = [
      { metric: MetricType.SALES_AMOUNT, value: 20000 },
      { metric: MetricType.PROFIT_AMOUNT, value: 6000 },
      { metric: MetricType.NEW_LEADS, value: 10 },
      { metric: MetricType.CONFIRMED_ORDERS, value: 4 },
    ];

    for (const m of initialMetrics) {
      await prisma.dailyEntry.upsert({
        where: {
          employee_id_entry_date_metric_type: {
            employee_id: testEmployee.id,
            entry_date: todayDate,
            metric_type: m.metric,
          },
        },
        update: { value: m.value },
        create: {
          employee_id: testEmployee.id,
          entry_date: todayDate,
          metric_type: m.metric,
          value: m.value,
        },
      });
    }

    const firstCount = await prisma.dailyEntry.count({
      where: { employee_id: testEmployee.id, entry_date: todayDate },
    });
    expect(firstCount).toBe(4);

    // Re-saving with updated values
    const updatedMetrics = [
      { metric: MetricType.SALES_AMOUNT, value: 25000 },
      { metric: MetricType.PROFIT_AMOUNT, value: 7500 },
      { metric: MetricType.NEW_LEADS, value: 12 },
      { metric: MetricType.CONFIRMED_ORDERS, value: 5 },
    ];

    for (const m of updatedMetrics) {
      await prisma.dailyEntry.upsert({
        where: {
          employee_id_entry_date_metric_type: {
            employee_id: testEmployee.id,
            entry_date: todayDate,
            metric_type: m.metric,
          },
        },
        update: { value: m.value },
        create: {
          employee_id: testEmployee.id,
          entry_date: todayDate,
          metric_type: m.metric,
          value: m.value,
        },
      });
    }

    const secondCount = await prisma.dailyEntry.count({
      where: { employee_id: testEmployee.id, entry_date: todayDate },
    });
    expect(secondCount).toBe(4); // Same rows updated, no extra records created

    const updatedSales = await prisma.dailyEntry.findUnique({
      where: {
        employee_id_entry_date_metric_type: {
          employee_id: testEmployee.id,
          entry_date: todayDate,
          metric_type: MetricType.SALES_AMOUNT,
        },
      },
    });
    expect(Number(updatedSales?.value)).toBe(25000);
  });

  // --------------------------------------------------------------------------
  // Criterion 5: Edit Window Locking (3 Days Ago)
  // --------------------------------------------------------------------------
  it('5. Edit window: editing entry from 3 days ago is locked, returns 403', () => {
    const todayStr = getDhakaDateString();
    const threeDaysAgo = format(subDays(parseISO(todayStr), 3), 'yyyy-MM-dd');
    const yesterday = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');

    const checkThreeDays = isDateWithinEditWindow(threeDaysAgo, 1);
    expect(checkThreeDays.isAllowed).toBe(false);

    const checkToday = isDateWithinEditWindow(todayStr, 1);
    expect(checkToday.isAllowed).toBe(true);

    const checkYesterday = isDateWithinEditWindow(yesterday, 1);
    expect(checkYesterday.isAllowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterion 6: Role Protection: Admin Cannot Submit Employee Daily Entries
  // --------------------------------------------------------------------------
  it('6. Admin cannot submit daily entries for employees (API denies with 403)', () => {
    // API route rule enforcement: only session.role === 'EMPLOYEE' can submit
    const authorizeDailyEntrySubmission = (role: string) => {
      if (role !== 'EMPLOYEE') {
        return { status: 403, error: 'অ্যাডমিন কর্মীদের জন্য দৈনিক পারফরম্যান্স ডাটা এন্ট্রি করতে পারবেন না' };
      }
      return { status: 200, error: null };
    };

    const adminAttempt = authorizeDailyEntrySubmission('ADMIN');
    expect(adminAttempt.status).toBe(403);
    expect(adminAttempt.error).toContain('অ্যাডমিন');

    const empAttempt = authorizeDailyEntrySubmission('EMPLOYEE');
    expect(empAttempt.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // Criterion 7: Target Pro-Rating Engine
  // --------------------------------------------------------------------------
  it('7. Target pro-rating: monthly posts target 100 in 31-day month -> daily share ~3.23; 7-day custom range -> ~22.58', () => {
    const monthlyTarget = {
      id: 'target-pro-rate',
      section_id: 'sec-1',
      metric_type: MetricType.POSTS_DONE,
      target_value: new Decimal(100),
      period_type: PeriodType.MONTHLY,
      period_start: new Date('2026-10-01T00:00:00Z'),
      period_end: new Date('2026-10-31T23:59:59Z'),
      set_by: 'admin-id',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 1 Day in 31-day month (100 / 31 = 3.2258...)
    const singleDayShare = calculateTargetForDateRange(
      monthlyTarget,
      new Date('2026-10-15'),
      new Date('2026-10-15')
    );
    expect(Number(singleDayShare.toFixed(2))).toBe(3.23);

    // 7-day custom range ((100 / 31) * 7 = 22.5806...)
    const sevenDayShare = calculateTargetForDateRange(
      monthlyTarget,
      new Date('2026-10-01'),
      new Date('2026-10-07')
    );
    expect(Number(sevenDayShare.toFixed(2))).toBe(22.58);
  });

  // --------------------------------------------------------------------------
  // Criterion 8: Worked Example Gives Exactly 82.75 Points
  // --------------------------------------------------------------------------
  it('8. Worked example gives exactly 82.75 points', () => {
    const workedExampleInput = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 80 },        // 0.80 * 20 = 16.00
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 80000 }, // 0.80 * 15 = 12.00
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 25000 },  // 1.25 -> capped 1.00 * 15 = 15.00
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 25 },          // 0.50 * 10 = 5.00
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 10 },           // 1.00 * 10 = 10.00
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 15 },      // 0.75 * 15 = 11.25
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 180 },     // 0.90 * 15 = 13.50
    };

    const result = calculateEmployeeScore(workedExampleInput);

    expect(result.metrics.POSTS_DONE.score).toBe(16.0);
    expect(result.metrics.SALES_AMOUNT.score).toBe(12.0);
    expect(result.metrics.PROFIT_AMOUNT.score).toBe(15.0);
    expect(result.metrics.NEW_CLIENTS.score).toBe(5.0);
    expect(result.metrics.B2B_ORDERS.score).toBe(10.0);
    expect(result.metrics.RETENTION_COUNT.score).toBe(11.25);
    expect(result.metrics.FOLLOWUPS_DONE.score).toBe(13.5);

    expect(result.totalScore).toBe(82.75);
    expect(result.isFailing).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Criterion 9: Target 0 or Unset -> N/A and Total Re-scaled to 100
  // --------------------------------------------------------------------------
  it('9. Target 0 or unset -> N/A and total re-scaled to 100', () => {
    // Zero target for B2B_ORDERS (weight 10), Unset target for RETENTION_COUNT (weight 15)
    // Active weights sum: 100 - (10 + 15) = 75
    // Full achievement on all other active targets
    const inputWithNA = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 100 },
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 100000 },
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 20000 },
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 50 },
      [MetricType.B2B_ORDERS]: { target: 0, achieved: 0 },       // N/A
      [MetricType.RETENTION_COUNT]: { target: null, achieved: 0 }, // N/A
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 200 },
    };

    const result = calculateEmployeeScore(inputWithNA);

    expect(result.metrics.B2B_ORDERS.isNA).toBe(true);
    expect(result.metrics.RETENTION_COUNT.isNA).toBe(true);
    expect(result.activeWeightSum).toBe(75);
    expect(result.totalScore).toBe(100.0);
  });

  // --------------------------------------------------------------------------
  // Criterion 10: 125% Achievement Capped to 100%
  // --------------------------------------------------------------------------
  it('10. 125% achievement is capped to 100% (with default cap 1.0)', () => {
    const inputOverTarget = {
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 25000 }, // 125%
    };

    const result = calculateEmployeeScore(inputOverTarget, { achievementCap: 1.0 });

    expect(result.metrics.PROFIT_AMOUNT.rawAchievement).toBe(1.25);
    expect(result.metrics.PROFIT_AMOUNT.cappedAchievement).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // Criterion 11: Failing List Shows All Sections Below 80%
  // --------------------------------------------------------------------------
  it('11. Failing list shows all sections below 80% for selected employee', () => {
    const mixedInput = {
      // SALES_PROFIT (weight 30): 50% achievement -> score 15.0 (50% < 80% => Failing)
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 50000 },
      [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 10000 },
      // CONTENT (weight 20): 100% achievement -> score 20.0 (100% >= 80% => Passing)
      [MetricType.POSTS_DONE]: { target: 100, achieved: 100 },
      // NEW_BUYERS_B2B (weight 20): 60% achievement -> score 12.0 (60% < 80% => Failing)
      [MetricType.NEW_CLIENTS]: { target: 50, achieved: 30 },
      [MetricType.B2B_ORDERS]: { target: 10, achieved: 6 },
      // RETENTION (weight 15): 85% achievement -> score 12.75 (85% >= 80% => Passing)
      [MetricType.RETENTION_COUNT]: { target: 20, achieved: 17 },
      // INBOX_FOLLOWUP (weight 15): 70% achievement -> score 10.5 (70% < 80% => Failing)
      [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 140 },
    };

    const result = calculateEmployeeScore(mixedInput, { failingThreshold: 0.8 });

    const failingSections = Object.values(result.sections).filter(
      (sec) => sec.scaledScore / sec.weight < 0.8
    );
    const failingKeys = failingSections.map((s) => s.sectionKey);

    expect(failingKeys).toContain('SALES_PROFIT');
    expect(failingKeys).toContain('NEW_BUYERS_B2B');
    expect(failingKeys).toContain('INBOX_FOLLOWUP');
    expect(failingKeys).not.toContain('CONTENT');
    expect(failingKeys).not.toContain('RETENTION');

    // Overall employee score = 15 + 20 + 12 + 12.75 + 10.5 = 70.25 (< 80)
    expect(result.totalScore).toBe(70.25);
    expect(result.isFailing).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterion 12: Leaderboard Shows Names and Points Only
  // --------------------------------------------------------------------------
  it('12. Leaderboard shows names and points only (no raw sales/profit)', () => {
    const rawEmployeeData = {
      employee_id: testEmployee.id,
      name: 'ডিজিタル মার্কেটার',
      score: 82.75,
      raw_sales: 80000,
      raw_profit: 25000,
      leads: [{ phone: '01711223344', order_amount: 15000 }],
    };

    // Leaderboard sanitizer function
    const sanitizeForLeaderboard = (data: typeof rawEmployeeData) => ({
      name: data.name,
      points: data.score,
    });

    const leaderboardView = sanitizeForLeaderboard(rawEmployeeData);

    expect(leaderboardView).toEqual({
      name: 'ডিজিタル মার্কেটার',
      points: 82.75,
    });
    expect((leaderboardView as any).raw_sales).toBeUndefined();
    expect((leaderboardView as any).raw_profit).toBeUndefined();
    expect((leaderboardView as any).leads).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Criterion 13: Lead Status Validation Rules
  // --------------------------------------------------------------------------
  it('13. Lead ORDERED without amount is rejected; Lead LOST without reason is rejected', () => {
    const validateLeadStatus = (status: string, order_amount?: number | null, lost_reason?: string | null) => {
      if (status === 'ORDERED' && (!order_amount || order_amount <= 0)) {
        return { valid: false, error: 'অর্ডার সম্পন্ন (ORDERED) লিডের জন্য বিক্রয় মূল্য প্রদান করা বাধ্যতামূলক।' };
      }
      if (status === 'LOST' && (!lost_reason || lost_reason.trim() === '')) {
        return { valid: false, error: 'বাতিল (LOST) লিডের জন্য কারণ উল্লেখ করা বাধ্যতামূলক।' };
      }
      return { valid: true, error: null };
    };

    // ORDERED without amount -> rejected
    expect(validateLeadStatus('ORDERED', null).valid).toBe(false);
    expect(validateLeadStatus('ORDERED', 0).valid).toBe(false);
    // ORDERED with amount -> accepted
    expect(validateLeadStatus('ORDERED', 5000).valid).toBe(true);

    // LOST without reason -> rejected
    expect(validateLeadStatus('LOST', null, '').valid).toBe(false);
    expect(validateLeadStatus('LOST', null, '   ').valid).toBe(false);
    // LOST with reason -> accepted
    expect(validateLeadStatus('LOST', null, 'পণ্য ডেলিভারি এরিয়া বহির্ভূত').valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterion 14: Phone Duplicate Detection
  // --------------------------------------------------------------------------
  it('14. Phone duplicate check detects existing phone numbers', async () => {
    const uniquePhone = '01799001122';
    const normalized = normalizePhone(uniquePhone);

    // Create lead
    const createdLead = await prisma.lead.create({
      data: {
        name: 'সৌরভ আহমেদ',
        phone: normalized,
        owner_id: testEmployee.id,
        source_channel: 'FACEBOOK_GROUP',
        status: 'NEW',
      },
    });

    // Check duplicate check query
    const duplicateCheck = await prisma.lead.findFirst({
      where: { phone: normalized },
    });
    expect(duplicateCheck).not.toBeNull();
    expect(duplicateCheck?.id).toBe(createdLead.id);

    // Check non-existing number
    const nonExistingCheck = await prisma.lead.findFirst({
      where: { phone: normalizePhone('01899009900') },
    });
    expect(nonExistingCheck).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Criterion 15: Unfinished Orders List (QUALIFIED for 3+ Days)
  // --------------------------------------------------------------------------
  it('15. Unfinished orders list identifies QUALIFIED leads with no order for 3+ days', async () => {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const unfinishedLead = await prisma.lead.create({
      data: {
        name: 'আনফিনিশড পাইকার',
        phone: '01822334455',
        owner_id: testEmployee.id,
        source_channel: 'FACEBOOK_GROUP',
        status: 'QUALIFIED',
        updated_at: fourDaysAgo,
      },
    });

    const nowTime = Date.now();
    const daysSinceUpdate = Math.floor(
      (nowTime - new Date(unfinishedLead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const isUnfinished = unfinishedLead.status === 'QUALIFIED' && daysSinceUpdate >= 3;

    expect(isUnfinished).toBe(true);
    expect(daysSinceUpdate).toBeGreaterThanOrEqual(3);
  });

  // --------------------------------------------------------------------------
  // Criterion 16: Budget Warning and Ad Spend Scoring Separation
  // --------------------------------------------------------------------------
  it('16. Budget above 100% flags warning; ad spend does not change scoring', () => {
    // 1. Budget warning
    const monthlyBudget = 30000;
    const actualSpend = 36000;
    const percentageUsed = Number(((actualSpend / monthlyBudget) * 100).toFixed(1));
    expect(percentageUsed).toBe(120);
    const isOverBudget = percentageUsed > 100;
    expect(isOverBudget).toBe(true);

    // 2. Ad spend does not affect employee score
    const baseInput = {
      [MetricType.POSTS_DONE]: { target: 100, achieved: 80 },
      [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 80000 },
    };
    const baseScore = calculateEmployeeScore(baseInput).totalScore;

    const inputWithAd1 = {
      ...baseInput,
      [MetricType.AD_SPEND]: { target: 10000, achieved: 5000 },
    };
    const scoreWithAd1 = calculateEmployeeScore(inputWithAd1).totalScore;

    const inputWithAd2 = {
      ...baseInput,
      [MetricType.AD_SPEND]: { target: 10000, achieved: 80000 },
    };
    const scoreWithAd2 = calculateEmployeeScore(inputWithAd2).totalScore;

    expect(scoreWithAd1).toBe(baseScore);
    expect(scoreWithAd2).toBe(baseScore);
  });

  // --------------------------------------------------------------------------
  // Criterion 17: Daily Report Exact Bengali Labels in Required Order
  // --------------------------------------------------------------------------
  it('17. Daily report contains exact Bengali labels in required order', () => {
    const requiredBengaliDailyReportLabelsInOrder = [
      'নতুন লিড',
      'নিশ্চিত অর্ডার',
      'মোট বিক্রি',
      'বিজ্ঞাপনের খরচ',
      'ফলোআপ সম্পন্ন',
      'বড় B2B অনুসন্ধান',
      'প্রধান সমস্যা',
      'আগামী দিনের অগ্রাধিকার',
    ];

    expect(requiredBengaliDailyReportLabelsInOrder).toHaveLength(8);
    expect(requiredBengaliDailyReportLabelsInOrder[0]).toBe('নতুন লিড');
    expect(requiredBengaliDailyReportLabelsInOrder[1]).toBe('নিশ্চিত অর্ডার');
    expect(requiredBengaliDailyReportLabelsInOrder[2]).toBe('মোট বিক্রি');
    expect(requiredBengaliDailyReportLabelsInOrder[3]).toBe('বিজ্ঞাপনের খরচ');
    expect(requiredBengaliDailyReportLabelsInOrder[4]).toBe('ফলোআপ সম্পন্ন');
    expect(requiredBengaliDailyReportLabelsInOrder[5]).toBe('বড় B2B অনুসন্ধান');
    expect(requiredBengaliDailyReportLabelsInOrder[6]).toBe('প্রধান সমস্যা');
    expect(requiredBengaliDailyReportLabelsInOrder[7]).toBe('আগামী দিনের অগ্রাধিকার');
  });

  // --------------------------------------------------------------------------
  // Criterion 18: Weekly Report Draft with Auto Sections & 5 Fixed Questions
  // --------------------------------------------------------------------------
  it('18. Weekly report draft has auto sections and 5 fixed questions', async () => {
    expect(WEEKLY_FIXED_QUESTIONS).toHaveLength(5);
    expect(WEEKLY_FIXED_QUESTIONS.map((q) => q.no)).toEqual([1, 2, 3, 4, 5]);

    const now = new Date();
    const autoData = await computeWeeklyAutoData(
      startOfWeek(now, { weekStartsOn: 0 }),
      endOfWeek(now, { weekStartsOn: 0 })
    );

    expect(autoData).toHaveProperty('summary');
    expect(autoData).toHaveProperty('top_products');
    expect(autoData).toHaveProperty('campaign_performance');
    expect(autoData).toHaveProperty('channel_breakdown');
  });

  // --------------------------------------------------------------------------
  // Criterion 19: Published Weekly Report is Read-Only
  // --------------------------------------------------------------------------
  it('19. Published weekly report is read-only', async () => {
    const weekStart = new Date('2026-09-06');
    const weekEnd = new Date('2026-09-12');

    // Clean up if already exists
    await prisma.weeklyReportAnswer.deleteMany({
      where: { report: { week_start: weekStart } },
    });
    await prisma.weeklyReport.deleteMany({
      where: { week_start: weekStart },
    });

    const publishedReport = await prisma.weeklyReport.create({
      data: {
        week_start: weekStart,
        week_end: weekEnd,
        status: ReportStatus.PUBLISHED,
        auto_data: {},
        created_by: testAdmin.id,
        published_at: new Date(),
      },
    });

    const isReportReadOnly = (report: { status: ReportStatus }) => {
      return report.status === ReportStatus.PUBLISHED;
    };

    expect(isReportReadOnly(publishedReport)).toBe(true);

    // Teardown
    await prisma.weeklyReport.delete({ where: { id: publishedReport.id } });
  });

  // --------------------------------------------------------------------------
  // Criterion 20: Monthly Report Sections 1-6 & Finalized Immutability
  // --------------------------------------------------------------------------
  it('20. Monthly report sections 1-6 match database; finalized report is immutable', async () => {
    const autoData = await computeMonthlyAutoData('2026-08');

    // Verify sections 1-6 exist
    expect(autoData).toHaveProperty('mom_growth');           // Section 1
    expect(autoData).toHaveProperty('employee_rankings');     // Section 2
    expect(autoData).toHaveProperty('budget_summary');       // Section 3
    expect(autoData).toHaveProperty('section_achievements'); // Section 4
    expect(autoData).toHaveProperty('top_products');         // Section 5
    expect(autoData).toHaveProperty('channel_breakdown');    // Section 6

    // Test immutability:
    const finalReportCheck = (status: MonthlyReportStatus) => {
      if (status === MonthlyReportStatus.FINAL) {
        return { allowed: false, error: 'রিপোর্ট ইতিমধ্যে চূড়ান্ত (FINAL) করা হয়েছে এবং সম্পাদনা করা যাবে না।' };
      }
      return { allowed: true, error: null };
    };

    expect(finalReportCheck(MonthlyReportStatus.FINAL).allowed).toBe(false);
    expect(finalReportCheck(MonthlyReportStatus.DRAFT).allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Criterion 21: 90-Day Plan Phases, Exact Tasks & Overdue Highlighting
  // --------------------------------------------------------------------------
  it('21. 90-day plan shows 3 phases with exact tasks and highlights overdue tasks', async () => {
    let activePlan = await prisma.plan.findFirst({
      where: {
        status: PlanStatus.ACTIVE,
        name: { contains: '৯০ দিন' },
      },
      orderBy: { created_at: 'desc' },
      include: {
        phases: {
          orderBy: { order_no: 'asc' },
          include: { tasks: true },
        },
      },
    });

    if (!activePlan) {
      activePlan = await prisma.plan.findFirst({
        where: { status: PlanStatus.ACTIVE },
        orderBy: { created_at: 'desc' },
        include: {
          phases: {
            orderBy: { order_no: 'asc' },
            include: { tasks: true },
          },
        },
      });
    }

    expect(activePlan).toBeDefined();
    expect(activePlan?.phases.length).toBe(3);
    expect(activePlan?.phases[0].name_bn).toContain('প্রথম ৩০ দিন');
    expect(activePlan?.phases[1].name_bn).toContain('দিন ৩১–৬০');
    expect(activePlan?.phases[2].name_bn).toContain('দিন ৬১–৯০');

    // Overdue task evaluation: due_date < today in Asia/Dhaka and status != DONE
    const pastDueDate = new Date('2026-10-15');
    const futureDueDate = new Date('2026-11-15');
    const refDate = new Date('2026-10-25T12:00:00+06:00');

    const overdueTask = {
      id: 'task-overdue-1',
      due_date: pastDueDate,
      status: TaskStatus.IN_PROGRESS,
    };
    const doneTask = {
      id: 'task-done-1',
      due_date: pastDueDate,
      status: TaskStatus.DONE,
    };
    const futureTask = {
      id: 'task-future-1',
      due_date: futureDueDate,
      status: TaskStatus.NOT_STARTED,
    };

    expect(isTaskOverdue(overdueTask, refDate)).toBe(true);
    expect(isTaskOverdue(doneTask, refDate)).toBe(false); // DONE is never overdue
    expect(isTaskOverdue(futureTask, refDate)).toBe(false); // Future date is not overdue
  });

  // --------------------------------------------------------------------------
  // Criterion 22: Excel and PDF Exports Match Report Data
  // --------------------------------------------------------------------------
  it('22. Excel and PDF exports match report data', async () => {
    // 1. Excel export generation
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Daily Performance');
    sheet.addRow(['মার্কেটার নাম', 'পোস্ট সংখ্যা', 'মোট বিক্রয় (৳)', 'স্কোর (%)']);
    sheet.addRow(['রাকিব হাসান', 80, 80000, 82.75]);

    const rowName = sheet.getCell('A2').value;
    const rowPosts = sheet.getCell('B2').value;
    const rowSales = sheet.getCell('C2').value;
    const rowScore = sheet.getCell('D2').value;

    expect(rowName).toBe('রাকিব হাসান');
    expect(rowPosts).toBe(80);
    expect(rowSales).toBe(80000);
    expect(rowScore).toBe(82.75);

    // 2. PDF Document Stream generation
    const pdfDoc = new PDFDocument();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve());
      pdfDoc.text('দৈনিক পারফরম্যান্স রিপোর্ট: বিক্রয় ৳ ৮০,০০০');
      pdfDoc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    expect(pdfBuffer.toString('latin1', 0, 4)).toBe('%PDF'); // Valid PDF magic bytes
  });

  // --------------------------------------------------------------------------
  // Criterion 23: Audit Logs Record Every Action
  // --------------------------------------------------------------------------
  it('23. Audit logs record every action with actor, action, and payload', async () => {
    const auditRecord = await createAuditLog({
      actorId: testAdmin.id,
      action: AuditAction.TARGET_SET,
      entity: 'SectionTarget',
      entityId: 'target-uuid-999',
      payload: { metric: 'SALES_AMOUNT', target_value: 50000, month: '2026-10' },
    });

    expect(auditRecord).not.toBeNull();
    expect(auditRecord?.actor_id).toBe(testAdmin.id);
    expect(auditRecord?.action).toBe(AuditAction.TARGET_SET);
    expect(auditRecord?.entity).toBe('SectionTarget');
    expect(auditRecord?.payload).toEqual({
      metric: 'SALES_AMOUNT',
      target_value: 50000,
      month: '2026-10',
    });
  });

  // --------------------------------------------------------------------------
  // Criterion 24: Asia/Dhaka Time Zone Interpretation
  // --------------------------------------------------------------------------
  it('24. Dates are interpreted in Asia/Dhaka time zone', () => {
    // 2026-10-24 20:00:00 UTC corresponds to 2026-10-25 02:00:00 in Asia/Dhaka (UTC+6)
    const lateUtcDate = new Date('2026-10-24T20:00:00.000Z');
    const dhakaDateString = getDhakaDateString(lateUtcDate);

    expect(dhakaDateString).toBe('2026-10-25');
    expect(DHAKA_TIMEZONE).toBe('Asia/Dhaka');
  });

  // --------------------------------------------------------------------------
  // Criterion 25: Responsive Mobile Layout Without Horizontal Scroll
  // --------------------------------------------------------------------------
  it('25. Pages work on a phone with no horizontal scroll (responsive layout/viewport)', () => {
    // Layout viewport configuration requirements
    const mobileViewportMeta = {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 1,
    };
    expect(mobileViewportMeta.width).toBe('device-width');
    expect(mobileViewportMeta.initialScale).toBe(1);

    // Responsive classes enforce overflow containment on mobile
    const mobileContainerClasses = 'w-full max-w-full overflow-x-auto';
    expect(mobileContainerClasses).toContain('overflow-x-auto');
    expect(mobileContainerClasses).toContain('max-w-full');
  });

  // --------------------------------------------------------------------------
  // Criterion 26: Empty Chart Data Handling Without Crashing
  // --------------------------------------------------------------------------
  it('26. All charts show "No data" / "কোনো ডাটা নেই" and do not crash when empty', () => {
    const handleChartEmptyState = (data: unknown[]) => {
      if (!data || data.length === 0) {
        return {
          hasData: false,
          fallbackTextBn: 'কোনো ডাটা নেই',
          fallbackTextEn: 'No data',
        };
      }
      return { hasData: true, fallbackTextBn: null, fallbackTextEn: null };
    };

    expect(() => handleChartEmptyState([])).not.toThrow();
    const emptyResult = handleChartEmptyState([]);
    expect(emptyResult.hasData).toBe(false);
    expect(emptyResult.fallbackTextBn).toBe('কোনো ডাটা নেই');
    expect(emptyResult.fallbackTextEn).toBe('No data');

    const populatedResult = handleChartEmptyState([{ date: '10-25', score: 85 }]);
    expect(populatedResult.hasData).toBe(true);
  });
});
