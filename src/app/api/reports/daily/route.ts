import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore } from '@/lib/scoring';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import { MetricType } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    // Score section/metric names follow the language the admin is reading in.
    const lang = readLangFromRequest(req);

    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || getDhakaDateString();
    const targetDate = parseDateOnly(dateStr);

    // 1. Fetch all active employees
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      include: {
        assignments_as_employee: {
          include: { section: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all targets
    const allTargets = await prisma.sectionTarget.findMany();

    // 3. Date boundaries in UTC Dhaka (+6 hrs)
    const dayStartUtc = new Date(`${dateStr}T00:00:00+06:00`);
    const dayEndUtc = new Date(`${dateStr}T23:59:59.999+06:00`);

    // 4. Fetch scoring settings
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const cap = settings ? Number(settings.achievement_cap) : 1.0;
    const failingThreshold = settings ? Number(settings.failing_threshold) : 0.8;

    const employeeReports: Record<string, unknown>[] = [];
    let teamSales = 0;
    let teamProfit = 0;
    let teamPosts = 0;
    let teamNewClients = 0;
    let teamB2b = 0;
    let teamRetention = 0;
    let teamFollowups = 0;
    let totalScoreSum = 0;
    let passingCount = 0;
    let failingCount = 0;

    for (const emp of employees) {
      const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
      const sectionNames = emp.assignments_as_employee.map((a: any) => a.section.name);

      // Filter targets for assigned sections
      const empTargets = allTargets.filter((t) => assignedSectionIds.includes(t.section_id));
      const dailyTargets = calculateEffectiveTargetsForRange(empTargets, targetDate, targetDate);

      // Posts completed on this date
      const postsCount = await prisma.linkCompletion.count({
        where: {
          employee_id: emp.id,
          completed_at: { gte: dayStartUtc, lte: dayEndUtc },
          undone_at: null,
        },
      });

      // Daily entries
      const entries = await prisma.dailyEntry.findMany({
        where: {
          employee_id: emp.id,
          entry_date: targetDate,
        },
      });

      const metricMap: Record<string, number> = {
        POSTS_DONE: postsCount,
        SALES_AMOUNT: 0,
        PROFIT_AMOUNT: 0,
        NEW_CLIENTS: 0,
        B2B_ORDERS: 0,
        RETENTION_COUNT: 0,
        FOLLOWUPS_DONE: 0,
      };

      for (const e of entries) {
        if (e.metric_type !== MetricType.POSTS_DONE) {
          metricMap[e.metric_type] = Number(e.value);
        }
      }

      // Daily text
      const dailyText = await prisma.dailyText.findUnique({
        where: {
          employee_id_entry_date: {
            employee_id: emp.id,
            entry_date: targetDate,
          },
        },
      });

      // Calculate employee score
      const scoringInput = {
        [MetricType.POSTS_DONE]: { target: dailyTargets.POSTS_DONE || null, achieved: metricMap.POSTS_DONE },
        [MetricType.SALES_AMOUNT]: { target: dailyTargets.SALES_AMOUNT || null, achieved: metricMap.SALES_AMOUNT },
        [MetricType.PROFIT_AMOUNT]: { target: dailyTargets.PROFIT_AMOUNT || null, achieved: metricMap.PROFIT_AMOUNT },
        [MetricType.NEW_CLIENTS]: { target: dailyTargets.NEW_CLIENTS || null, achieved: metricMap.NEW_CLIENTS },
        [MetricType.B2B_ORDERS]: { target: dailyTargets.B2B_ORDERS || null, achieved: metricMap.B2B_ORDERS },
        [MetricType.RETENTION_COUNT]: { target: dailyTargets.RETENTION_COUNT || null, achieved: metricMap.RETENTION_COUNT },
        [MetricType.FOLLOWUPS_DONE]: { target: dailyTargets.FOLLOWUPS_DONE || null, achieved: metricMap.FOLLOWUPS_DONE },
      };

      const scoreResult = calculateEmployeeScore(scoringInput, {
        achievementCap: cap,
        failingThreshold,
        lang,
      });

      // Accumulate team stats
      teamSales += metricMap.SALES_AMOUNT;
      teamProfit += metricMap.PROFIT_AMOUNT;
      teamPosts += metricMap.POSTS_DONE;
      teamNewClients += metricMap.NEW_CLIENTS;
      teamB2b += metricMap.B2B_ORDERS;
      teamRetention += metricMap.RETENTION_COUNT;
      teamFollowups += metricMap.FOLLOWUPS_DONE;
      totalScoreSum += scoreResult.totalScore;

      if (scoreResult.isFailing) {
        failingCount++;
      } else {
        passingCount++;
      }

      employeeReports.push({
        employee_id: emp.id,
        name: emp.name,
        email: emp.email,
        sections: sectionNames,
        metrics: metricMap,
        targets: dailyTargets,
        score: scoreResult.totalScore,
        is_failing: scoreResult.isFailing,
        sections_score: scoreResult.sections,
        daily_text: dailyText || null,
      });
    }

    const totalEmployees = employees.length;
    const teamAvgScore = totalEmployees > 0 ? Number((totalScoreSum / totalEmployees).toFixed(2)) : 0;

    // Executive Daily Report Sample Metrics (as requested by user)
    const newLeadsCount = await prisma.lead.count({
      where: {
        created_at: { gte: dayStartUtc, lte: dayEndUtc },
      },
    });

    const confirmedOrdersCount = await prisma.lead.count({
      where: {
        status: 'ORDERED',
        updated_at: { gte: dayStartUtc, lte: dayEndUtc },
      },
    });

    const b2bLeads = await prisma.lead.findMany({
      where: {
        created_at: { gte: dayStartUtc, lte: dayEndUtc },
        OR: [
          { buyer_type: { in: ['WHOLESALER', 'DEALER', 'RESTAURANT'] } },
          { expected_value: { gte: 10000 } },
        ],
      },
      select: {
        expected_value: true,
        order_amount: true,
      },
    });
    const b2bInquiriesCount = b2bLeads.length;
    const b2bInquiriesValue = b2bLeads.reduce(
      (acc, l) => acc + Number(l.order_amount || l.expected_value || 0),
      0
    );

    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE' },
      select: { budget_amount: true },
    });
    const dailyAdSpend = Math.round(
      activeCampaigns.reduce((acc, c) => acc + Number(c.budget_amount) / 30, 0)
    );

    const mainIssues = employeeReports
      .map((e: any) => e.daily_text?.main_issue)
      .filter((txt: any): txt is string => Boolean(txt && txt.trim().length > 0));

    const nextPriorities = employeeReports
      .map((e: any) => e.daily_text?.next_priorities)
      .filter((txt: any): txt is string => Boolean(txt && txt.trim().length > 0));

    return NextResponse.json({
      date: dateStr,
      executive_table: {
        new_leads: newLeadsCount,
        confirmed_orders: confirmedOrdersCount,
        total_sales: teamSales,
        ad_spend: dailyAdSpend,
        followups_done: teamFollowups,
        b2b_inquiries_count: b2bInquiriesCount,
        b2b_inquiries_value: b2bInquiriesValue,
        main_issues: mainIssues,
        next_priorities: nextPriorities,
      },
      summary: {
        total_employees: totalEmployees,
        team_sales: teamSales,
        team_profit: teamProfit,
        team_posts: teamPosts,
        team_new_clients: teamNewClients,
        team_b2b: teamB2b,
        team_retention: teamRetention,
        team_followups: teamFollowups,
        team_avg_score: teamAvgScore,
        passing_count: passingCount,
        failing_count: failingCount,
      },
      employees: employeeReports,
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    return NextResponse.json({ error: 'Failed to generate daily report' }, { status: 500 });
  }
}
