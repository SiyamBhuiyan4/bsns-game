import { describe, it, expect, beforeAll } from 'vitest';
import {
  resolveDashboardPeriod,
  getAdminDashboardData,
  CHANNEL_BN_MAP,
} from '../src/lib/dashboard';
import prisma from '../src/lib/prisma';
import { getDhakaDateString } from '../src/lib/date';
import { subDays, format, parseISO } from 'date-fns';

describe('Admin Dashboard & Charts (Section 8.1 & Section 9)', () => {
  const todayStr = getDhakaDateString();

  describe('1. Period Selector Resolution', () => {
    it('should resolve "today" period correctly', () => {
      const res = resolveDashboardPeriod({ period: 'today' });
      expect(res.period).toBe('today');
      expect(res.startDate).toBe(todayStr);
      expect(res.endDate).toBe(todayStr);
      expect(res.label).toContain(todayStr);
    });

    it('should resolve "yesterday" period correctly', () => {
      const res = resolveDashboardPeriod({ period: 'yesterday' });
      const expectedYest = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
      expect(res.period).toBe('yesterday');
      expect(res.startDate).toBe(expectedYest);
      expect(res.endDate).toBe(expectedYest);
    });

    it('should resolve "last7days" period correctly', () => {
      const res = resolveDashboardPeriod({ period: 'last7days' });
      const expectedStart = format(subDays(parseISO(todayStr), 6), 'yyyy-MM-dd');
      expect(res.period).toBe('last7days');
      expect(res.startDate).toBe(expectedStart);
      expect(res.endDate).toBe(todayStr);
    });

    it('should resolve "month" period correctly', () => {
      const res = resolveDashboardPeriod({ period: 'month' });
      expect(res.period).toBe('month');
      expect(res.startDate).toBe(`${todayStr.slice(0, 7)}-01`);
      expect(res.endDate).toBe(todayStr);
    });

    it('should resolve "thisMonth" period correctly and as default', () => {
      const res1 = resolveDashboardPeriod({ period: 'thisMonth' });
      expect(res1.period).toBe('thisMonth');
      expect(res1.startDate).toBe(`${todayStr.slice(0, 7)}-01`);
      expect(res1.endDate).toBe(todayStr);

      const resDefault = resolveDashboardPeriod({});
      expect(resDefault.period).toBe('thisMonth');
      expect(resDefault.startDate).toBe(`${todayStr.slice(0, 7)}-01`);
      expect(resDefault.endDate).toBe(todayStr);
    });

    it('should resolve "custom" period with valid dates', () => {
      const res = resolveDashboardPeriod({
        period: 'custom',
        from: '2026-10-01',
        to: '2026-10-15',
      });
      expect(res.period).toBe('custom');
      expect(res.startDate).toBe('2026-10-01');
      expect(res.endDate).toBe('2026-10-15');
    });

    it('should automatically swap dates if "from" is after "to" in custom period', () => {
      const res = resolveDashboardPeriod({
        period: 'custom',
        from: '2026-10-25',
        to: '2026-10-10',
      });
      expect(res.period).toBe('custom');
      expect(res.startDate).toBe('2026-10-10');
      expect(res.endDate).toBe('2026-10-25');
    });

    it('should fallback to defaults when invalid custom dates given', () => {
      const res = resolveDashboardPeriod({
        period: 'custom',
        from: 'invalid-date',
        to: 'not-a-date',
      });
      expect(res.period).toBe('custom');
      expect(res.startDate).toBe(`${todayStr.slice(0, 7)}-01`);
      expect(res.endDate).toBe(todayStr);
    });

    it('should fallback to defaults when invalid calendar dates given (e.g. Feb 31)', () => {
      const res = resolveDashboardPeriod({
        period: 'custom',
        from: '2026-02-31',
        to: '2026-02-32',
      });
      expect(res.period).toBe('custom');
      expect(res.startDate).toBe(`${todayStr.slice(0, 7)}-01`);
      expect(res.endDate).toBe(todayStr);
    });
  });

  describe('2. Dashboard Data Fetching & Aggregations', () => {
    let monthData: any;

    beforeAll(async () => {
      monthData = await getAdminDashboardData({ period: 'month' });
    });

    it('should return complete AdminDashboardData structure with all 6 summary metrics', () => {
      const data = monthData;

      // Check top-level properties
      expect(data).toHaveProperty('periodInfo');
      expect(data).toHaveProperty('summaryCards');
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('planWidget');
      expect(data).toHaveProperty('charts');

      // Check Summary Cards
      const sc = data.summaryCards;
      expect(typeof sc.activeEmployeesCount).toBe('number');
      expect(sc.activeEmployeesCount).toBeGreaterThanOrEqual(0);
      expect(typeof sc.activeSectionsCount).toBe('number');
      expect(typeof sc.linksCompletedCount).toBe('number');
      expect(typeof sc.failingEmployeesCount).toBe('number');
      expect(sc.failingEmployeesCount).toBeGreaterThanOrEqual(0);

      // Check Budget Used
      expect(sc.budgetUsed).toHaveProperty('monthlyBudget');
      expect(sc.budgetUsed).toHaveProperty('actualSpend');
      expect(sc.budgetUsed).toHaveProperty('percentage');
      expect(sc.budgetUsed).toHaveProperty('statusColor');
      expect(['green', 'yellow', 'red']).toContain(sc.budgetUsed.statusColor);
    });

    it('should verify the 3 Alerts: bottom products, 3+ day qualified leads, and over-budget campaigns', () => {
      const data = monthData;

      // Alerts
      expect(Array.isArray(data.alerts.bottomProducts)).toBe(true);
      expect(typeof data.alerts.staleQualifiedLeadsCount).toBe('number');
      expect(Array.isArray(data.alerts.overBudgetCampaigns)).toBe(true);

      // If bottom products exist, check fields
      if (data.alerts.bottomProducts.length > 0) {
        const prod = data.alerts.bottomProducts[0];
        expect(prod).toHaveProperty('name_bn');
        expect(prod).toHaveProperty('quantity');
        expect(prod).toHaveProperty('unit');
      }
    });

    it('should verify 90-Day Plan Widget properties', () => {
      const data = monthData;

      const pw = data.planWidget;
      expect(typeof pw.hasPlan).toBe('boolean');
      expect(typeof pw.currentPhaseName).toBe('string');
      expect(typeof pw.currentDay).toBe('number');
      expect(typeof pw.overallProgress).toBe('number');
      expect(typeof pw.totalTasksCount).toBe('number');
      expect(typeof pw.completedTasksCount).toBe('number');
      expect(typeof pw.overdueTasksCount).toBe('number');
      expect(pw.overallProgress).toBeGreaterThanOrEqual(0);
      expect(pw.overallProgress).toBeLessThanOrEqual(100);
    });

    describe('3. All 5 Charts Data Verification', () => {
      it('should return valid datasets for all 5 charts', () => {
        const data = monthData;
        const { charts } = data;

        // Chart 1: Section Achieved vs Target Bar Chart
        expect(Array.isArray(charts.sectionTargets)).toBe(true);
        expect(charts.sectionTargets.length).toBe(5); // 5 core sections
        const sec = charts.sectionTargets[0];
        expect(sec).toHaveProperty('sectionKey');
        expect(sec).toHaveProperty('name');
        expect(sec).toHaveProperty('target');
        expect(sec).toHaveProperty('achieved');
        expect(sec).toHaveProperty('percent');
        expect(sec).toHaveProperty('unit');

        // Chart 2: Team Score Share Pie Chart
        expect(Array.isArray(charts.teamScoreShare)).toBe(true);
        if (charts.teamScoreShare.length > 0) {
          const emp = charts.teamScoreShare[0];
          expect(emp).toHaveProperty('employeeId');
          expect(emp).toHaveProperty('name');
          expect(emp).toHaveProperty('score');
          expect(emp).toHaveProperty('percent');
        }

        // Chart 3: Daily Team Trend Line Chart (last 30 days)
        expect(Array.isArray(charts.dailyTeamTrend)).toBe(true);
        expect(charts.dailyTeamTrend.length).toBe(30); // 30 days
        const dayTrend = charts.dailyTeamTrend[0];
        expect(dayTrend).toHaveProperty('date');
        expect(dayTrend).toHaveProperty('total');

        // Chart 4: Campaign Budgets Bar Chart
        expect(Array.isArray(charts.campaignBudgets)).toBe(true);
        if (charts.campaignBudgets.length > 0) {
          const camp = charts.campaignBudgets[0];
          expect(camp).toHaveProperty('id');
          expect(camp).toHaveProperty('name');
          expect(camp).toHaveProperty('channel');
          expect(camp).toHaveProperty('budget');
          expect(camp).toHaveProperty('spend');
          expect(camp).toHaveProperty('usagePercent');
        }

        // Chart 5: Lead Sources Distribution Pie Chart
        expect(Array.isArray(charts.leadSources)).toBe(true);
        if (charts.leadSources.length > 0) {
          const lead = charts.leadSources[0];
          expect(lead).toHaveProperty('channel');
          expect(lead).toHaveProperty('name');
          expect(lead).toHaveProperty('count');
          expect(lead).toHaveProperty('percent');
        }
      });

      it('should handle "today" period without throwing any error', async () => {
        const data = await getAdminDashboardData({ period: 'today' });
        expect(data.periodInfo.period).toBe('today');
        expect(data.charts.sectionTargets.length).toBe(5);
        expect(data.charts.dailyTeamTrend.length).toBe(30);
      });

      it('should handle custom date range without throwing any error', async () => {
        const data = await getAdminDashboardData({
          period: 'custom',
          from: '2026-10-05',
          to: '2026-10-12',
        });
        expect(data.periodInfo.period).toBe('custom');
        expect(data.periodInfo.startDate).toBe('2026-10-05');
        expect(data.periodInfo.endDate).toBe('2026-10-12');
        expect(data.charts.sectionTargets.length).toBe(5);
      });
    });
  });
});
