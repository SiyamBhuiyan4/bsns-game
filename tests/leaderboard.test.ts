import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { parseDateOnly, getDhakaDateString } from '../src/lib/date';
import { calculateSectionScore, calculateTotalScore } from '../src/lib/scoring';
import { MetricType, PeriodType, UserRole } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock session user
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

import { GET as getLeaderboard } from '../src/app/api/employee/leaderboard/route';

describe('Leaderboard (Section 7.6) Tests', () => {
  let adminUser: any;
  let empTop: any;
  let empSecond: any;
  let testSection: any;
  let testLink: any;

  const todayStr = getDhakaDateString();
  const todayDate = parseDateOnly(todayStr);

  beforeAll(async () => {
    const passwordHash = await hashPassword('LeaderboardPass123!');
    const timestamp = Date.now();

    adminUser = await prisma.user.create({
      data: {
        name: 'Leaderboard Admin',
        email: `lb_admin_${timestamp}@test.com`,
        password_hash: passwordHash,
        role: UserRole.ADMIN,
      },
    });

    empTop = await prisma.user.create({
      data: {
        name: 'Top Performer Marketer',
        email: `lb_top_${timestamp}@test.com`,
        password_hash: passwordHash,
        role: UserRole.EMPLOYEE,
      },
    });

    empSecond = await prisma.user.create({
      data: {
        name: 'Second Place Marketer',
        email: `lb_second_${timestamp}@test.com`,
        password_hash: passwordHash,
        role: UserRole.EMPLOYEE,
      },
    });

    testSection = await prisma.groupSection.create({
      data: {
        name: `Leaderboard Section ${timestamp}`,
        description: 'Section for testing leaderboard calculation',
      },
    });

    // Assign employees to section
    await prisma.assignment.create({
      data: {
        employee_id: empTop.id,
        section_id: testSection.id,
        assigned_by: adminUser.id,
      },
    });

    await prisma.assignment.create({
      data: {
        employee_id: empSecond.id,
        section_id: testSection.id,
        assigned_by: adminUser.id,
      },
    });

    // Group link for posts completions
    testLink = await prisma.groupLink.create({
      data: {
        section_id: testSection.id,
        url: `https://facebook.com/groups/test_lb_${timestamp}`,
        title: 'Leaderboard Test Link',
      },
    });

    // Targets for Section: Daily & Monthly
    await prisma.sectionTarget.create({
      data: {
        section_id: testSection.id,
        metric_type: MetricType.SALES_AMOUNT,
        target_value: 100000.0,
        period_type: PeriodType.MONTHLY,
        period_start: parseDateOnly(`${todayStr.slice(0, 7)}-01`),
        period_end: parseDateOnly(`${todayStr.slice(0, 7)}-28`),
        set_by: adminUser.id,
      },
    });

    await prisma.sectionTarget.create({
      data: {
        section_id: testSection.id,
        metric_type: MetricType.PROFIT_AMOUNT,
        target_value: 20000.0,
        period_type: PeriodType.MONTHLY,
        period_start: parseDateOnly(`${todayStr.slice(0, 7)}-01`),
        period_end: parseDateOnly(`${todayStr.slice(0, 7)}-28`),
        set_by: adminUser.id,
      },
    });

    await prisma.sectionTarget.create({
      data: {
        section_id: testSection.id,
        metric_type: MetricType.POSTS_DONE,
        target_value: 100.0,
        period_type: PeriodType.MONTHLY,
        period_start: parseDateOnly(`${todayStr.slice(0, 7)}-01`),
        period_end: parseDateOnly(`${todayStr.slice(0, 7)}-28`),
        set_by: adminUser.id,
      },
    });

    // Create daily entries for empTop (higher score)
    await prisma.dailyEntry.create({
      data: {
        employee_id: empTop.id,
        entry_date: todayDate,
        metric_type: MetricType.SALES_AMOUNT,
        value: 100000.0, // 100% of target
      },
    });

    await prisma.dailyEntry.create({
      data: {
        employee_id: empTop.id,
        entry_date: todayDate,
        metric_type: MetricType.PROFIT_AMOUNT,
        value: 20000.0, // 100% of target
      },
    });

    // Create daily entries for empSecond (lower score)
    await prisma.dailyEntry.create({
      data: {
        employee_id: empSecond.id,
        entry_date: todayDate,
        metric_type: MetricType.SALES_AMOUNT,
        value: 50000.0, // 50% of target
      },
    });

    await prisma.dailyEntry.create({
      data: {
        employee_id: empSecond.id,
        entry_date: todayDate,
        metric_type: MetricType.PROFIT_AMOUNT,
        value: 10000.0, // 50% of target
      },
    });

    // Link completions for posts
    await prisma.linkCompletion.create({
      data: {
        group_link_id: testLink.id,
        employee_id: empTop.id,
        completed_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testLink) {
      await prisma.linkCompletion.deleteMany({ where: { group_link_id: testLink.id } });
      await prisma.groupLink.deleteMany({ where: { id: testLink.id } });
    }
    if (empTop && empSecond) {
      await prisma.dailyEntry.deleteMany({
        where: { employee_id: { in: [empTop.id, empSecond.id] } },
      });
      await prisma.assignment.deleteMany({
        where: { employee_id: { in: [empTop.id, empSecond.id] } },
      });
      await prisma.sectionTarget.deleteMany({ where: { section_id: testSection.id } });
      await prisma.groupSection.deleteMany({ where: { id: testSection.id } });
      await prisma.user.deleteMany({
        where: { id: { in: [empTop.id, empSecond.id, adminUser.id] } },
      });
    }
  });

  describe('Scoring Helper Functions', () => {
    it('should correctly calculate total score using calculateTotalScore', () => {
      const input = {
        [MetricType.POSTS_DONE]: { target: 100, achieved: 80 }, // 0.80 * 20 = 16
        [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 80000 }, // 0.80 * 15 = 12
        [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 25000 }, // cap 1.0 * 15 = 15
        [MetricType.NEW_CLIENTS]: { target: 50, achieved: 25 }, // 0.50 * 10 = 5
        [MetricType.B2B_ORDERS]: { target: 10, achieved: 10 }, // 1.0 * 10 = 10
        [MetricType.RETENTION_COUNT]: { target: 20, achieved: 15 }, // 0.75 * 15 = 11.25
        [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 180 }, // 0.90 * 15 = 13.50
      };

      const score = calculateTotalScore(input);
      expect(score).toBe(82.75);
    });

    it('should correctly calculate section scores using calculateSectionScore', () => {
      const input = {
        [MetricType.POSTS_DONE]: { target: 100, achieved: 80 },
        [MetricType.SALES_AMOUNT]: { target: 100000, achieved: 80000 },
        [MetricType.PROFIT_AMOUNT]: { target: 20000, achieved: 25000 },
        [MetricType.NEW_CLIENTS]: { target: 50, achieved: 25 },
        [MetricType.B2B_ORDERS]: { target: 10, achieved: 10 },
        [MetricType.RETENTION_COUNT]: { target: 20, achieved: 15 },
        [MetricType.FOLLOWUPS_DONE]: { target: 200, achieved: 180 },
      };

      const salesProfit = calculateSectionScore('SALES_PROFIT', input);
      const content = calculateSectionScore('content', input);
      const newBuyers = calculateSectionScore('NEW_BUYERS_B2B', input);
      const retention = calculateSectionScore('retention', input);
      const inboxFollowup = calculateSectionScore('INBOX_FOLLOWUP', input);

      expect(salesProfit).toBe(27.0); // 12 + 15
      expect(content).toBe(16.0); // 16
      expect(newBuyers).toBe(15.0); // 5 + 10
      expect(retention).toBe(11.25);
      expect(inboxFollowup).toBe(13.5);
    });
  });

  describe('Leaderboard API Endpoint & Security (Section 7.6)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      mockSessionUser.userId = '';
      const req = new NextRequest('http://localhost/api/employee/leaderboard');
      const res = await getLeaderboard(req);
      expect(res.status).toBe(401);
    });

    it('should allow EMPLOYEE access and return sorted array by total points descending', async () => {
      mockSessionUser.userId = empSecond.id;
      mockSessionUser.id = empSecond.id;
      mockSessionUser.name = empSecond.name;
      mockSessionUser.email = empSecond.email;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost/api/employee/leaderboard?period=thisMonth');
      const res = await getLeaderboard(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);

      // Verify descending order
      for (let i = 0; i < data.length - 1; i++) {
        expect(data[i].total_score).toBeGreaterThanOrEqual(data[i + 1].total_score);
        expect(data[i].rank).toBe(i + 1);
      }

      // Find our test employees in leaderboard
      const topIdx = data.findIndex((item: any) => item.employee_id === empTop.id);
      const secondIdx = data.findIndex((item: any) => item.employee_id === empSecond.id);

      expect(topIdx).toBeGreaterThanOrEqual(0);
      expect(secondIdx).toBeGreaterThanOrEqual(0);
      expect(topIdx).toBeLessThan(secondIdx);
      expect(data[topIdx].rank).toBeLessThan(data[secondIdx].rank);
    });

    it('should strictly enforce CRITICAL PRIVACY RULE: no raw sales, profit, leads, or client details', async () => {
      mockSessionUser.userId = empSecond.id;
      mockSessionUser.id = empSecond.id;
      mockSessionUser.name = empSecond.name;
      mockSessionUser.email = empSecond.email;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost/api/employee/leaderboard?period=thisMonth');
      const res = await getLeaderboard(req);
      const data = await res.json();

      expect(Array.isArray(data)).toBe(true);

      for (const item of data) {
        // Must contain points breakdown and total
        expect(item).toHaveProperty('rank');
        expect(item).toHaveProperty('employee_id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('total_score');
        expect(item).toHaveProperty('section_scores');
        expect(typeof item.total_score).toBe('number');
        expect(item.section_scores).toHaveProperty('sales_profit');
        expect(item.section_scores).toHaveProperty('content');
        expect(item.section_scores).toHaveProperty('new_buyers_b2b');
        expect(item.section_scores).toHaveProperty('retention');
        expect(item.section_scores).toHaveProperty('inbox_followup');

        // MUST NOT contain sensitive private data
        expect(item.sales_amount).toBeUndefined();
        expect(item.profit_amount).toBeUndefined();
        expect(item.leads_count).toBeUndefined();
        expect(item.client_names).toBeUndefined();
        expect(item.customer_details).toBeUndefined();
        expect(item.clients).toBeUndefined();
        expect(item.leads).toBeUndefined();
        expect(item.customers).toBeUndefined();
      }
    });

    it('should compute gap to next rank accurately for requesting employee', async () => {
      // 1. When empSecond (rank > 1) requests, gap is difference with person directly above
      mockSessionUser.userId = empSecond.id;
      mockSessionUser.id = empSecond.id;
      mockSessionUser.name = empSecond.name;
      mockSessionUser.email = empSecond.email;
      mockSessionUser.role = 'EMPLOYEE';

      const req2 = new NextRequest('http://localhost/api/employee/leaderboard?period=thisMonth');
      const res2 = await getLeaderboard(req2);
      const data2 = await res2.json();

      const secondUserItem = data2.find((i: any) => i.employee_id === empSecond.id);
      expect(secondUserItem).toBeDefined();
      expect(secondUserItem.is_current_user).toBe(true);

      const secondUserIndex = data2.findIndex((i: any) => i.employee_id === empSecond.id);
      if (secondUserIndex > 0) {
        const personAbove = data2[secondUserIndex - 1];
        const expectedGap = Number((personAbove.total_score - secondUserItem.total_score).toFixed(2));
        expect(secondUserItem.gap_to_next).toBe(expectedGap);
        expect(secondUserItem.gap_text).toContain('আপনার পরের র্যাঙ্ক থেকে ব্যবধান:');
        expect(secondUserItem.gap_text).toContain(`${expectedGap.toFixed(2)}`);
      }

      // 2. When empTop (rank 1) requests, gap is difference with rank 2
      mockSessionUser.userId = empTop.id;
      mockSessionUser.id = empTop.id;
      mockSessionUser.name = empTop.name;
      mockSessionUser.email = empTop.email;
      mockSessionUser.role = 'EMPLOYEE';

      const reqTop = new NextRequest('http://localhost/api/employee/leaderboard?period=thisMonth');
      const resTop = await getLeaderboard(reqTop);
      const dataTop = await resTop.json();

      const topUserItem = dataTop.find((i: any) => i.employee_id === empTop.id);
      expect(topUserItem).toBeDefined();
      expect(topUserItem.is_current_user).toBe(true);

      if (topUserItem.rank === 1 && dataTop.length > 1) {
        const rank2 = dataTop[1];
        const expectedLead = Number((topUserItem.total_score - rank2.total_score).toFixed(2));
        expect(topUserItem.gap_to_next).toBe(expectedLead);
        expect(topUserItem.gap_text).toContain('আপনার পরের র্যাঙ্ক থেকে ব্যবধান:');
        expect(topUserItem.gap_text).toContain(`${expectedLead.toFixed(2)}`);
      }
    });

    it('should support periods today, yesterday, last7days, and custom range', async () => {
      mockSessionUser.userId = empTop.id;
      mockSessionUser.id = empTop.id;
      mockSessionUser.name = empTop.name;
      mockSessionUser.email = empTop.email;
      mockSessionUser.role = 'EMPLOYEE';

      for (const p of ['today', 'yesterday', 'last7days', 'thisMonth']) {
        const req = new NextRequest(`http://localhost/api/employee/leaderboard?period=${p}`);
        const res = await getLeaderboard(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data)).toBe(true);
      }

      // Custom range
      const reqCustom = new NextRequest(
        `http://localhost/api/employee/leaderboard?period=custom&start_date=${todayStr}&end_date=${todayStr}`
      );
      const resCustom = await getLeaderboard(reqCustom);
      expect(resCustom.status).toBe(200);
      const dataCustom = await resCustom.json();
      expect(Array.isArray(dataCustom)).toBe(true);
    });

    it('should allow ADMIN access to view full leaderboard', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const req = new NextRequest('http://localhost/api/employee/leaderboard?period=thisMonth');
      const res = await getLeaderboard(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
