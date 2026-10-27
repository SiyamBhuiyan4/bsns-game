import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore, selectEmployeeTargets } from '@/lib/scoring';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import { MetricType } from '@prisma/client';
import { subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // The metric and section names follow the language the user is reading in.
    const lang = readLangFromRequest(req);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'monthly'; // 'daily', 'weekly', 'monthly'
    const dateParam = searchParams.get('date') || getDhakaDateString();

    let targetEmployeeId = session.userId;
    if (session.role === 'ADMIN' && searchParams.get('employee_id')) {
      targetEmployeeId = searchParams.get('employee_id')!;
    }

    // Determine date range in Dhaka
    const refDate = parseISO(dateParam);
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily') {
      startDate = parseDateOnly(dateParam);
      endDate = startDate;
    } else if (period === 'weekly') {
      startDate = startOfWeek(refDate, { weekStartsOn: 0 }); // Sunday
      endDate = endOfWeek(refDate, { weekStartsOn: 0 });
    } else {
      startDate = startOfMonth(refDate);
      endDate = endOfMonth(refDate);
    }

    // Targets are pro-rated over the period, so only compare against the days
    // that have actually happened (never past today in Dhaka).
    const todayDhakaStr = getDhakaDateString();
    if (period !== 'daily' && format(endDate, 'yyyy-MM-dd') > todayDhakaStr) {
      const clamped = parseDateOnly(todayDhakaStr);
      endDate = clamped < startDate ? startDate : clamped;
    }

    // 1. Get employee assigned sections
    const assignments = await prisma.assignment.findMany({
      where: { employee_id: targetEmployeeId },
      include: { section: true },
    });
    const sectionIds = assignments.map((a) => a.section_id);

    // 2. Fetch targets configured for these sections
    // Targets are often saved scoped to the employee with no section, so filter by both.
    const targets = selectEmployeeTargets(
      await prisma.sectionTarget.findMany(),
      targetEmployeeId,
      sectionIds
    );

    // Effective targets for the date range
    const effectiveTargets = calculateEffectiveTargetsForRange(targets, startDate, endDate);

    // Fallback & exact quota assignment logic:
    // If admin set assignment post_limit, use exact daily post limit for daily view
    const totalAssignedDailyPosts = assignments.reduce((sum, a) => sum + (a.post_limit || 0), 0);
    if (totalAssignedDailyPosts > 0) {
      if (period === 'daily') {
        effectiveTargets[MetricType.POSTS_DONE] = totalAssignedDailyPosts;
      } else if (!effectiveTargets[MetricType.POSTS_DONE] || effectiveTargets[MetricType.POSTS_DONE] === 0) {
        if (period === 'weekly') {
          effectiveTargets[MetricType.POSTS_DONE] = totalAssignedDailyPosts * 7;
        } else {
          effectiveTargets[MetricType.POSTS_DONE] = totalAssignedDailyPosts * 30;
        }
      }
    }

    // 3. Aggregate employee achievements over the range
    // A. Posts done
    const startUtc = new Date(`${format(startDate, 'yyyy-MM-dd')}T00:00:00+06:00`);
    const endUtc = new Date(`${format(endDate, 'yyyy-MM-dd')}T23:59:59.999+06:00`);

    const postsCount = await prisma.linkCompletion.count({
      where: {
        employee_id: targetEmployeeId,
        completed_at: { gte: startUtc, lte: endUtc },
        undone_at: null,
      },
    });

    // B. Daily entries
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
        employee_id: targetEmployeeId,
        entry_date: { gte: startDate, lte: endDate },
      },
    });

    const achievements: Record<string, number> = {
      POSTS_DONE: postsCount,
      SALES_AMOUNT: 0,
      PROFIT_AMOUNT: 0,
      NEW_CLIENTS: 0,
      B2B_ORDERS: 0,
      RETENTION_COUNT: 0,
      FOLLOWUPS_DONE: 0,
    };

    for (const de of dailyEntries) {
      if (de.metric_type !== MetricType.POSTS_DONE) {
        achievements[de.metric_type] = (achievements[de.metric_type] || 0) + Number(de.value);
      }
    }

    // 4. Load Scoring Settings
    const scoringSettings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const cap = scoringSettings ? Number(scoringSettings.achievement_cap) : 1.0;
    const failingThreshold = scoringSettings ? Number(scoringSettings.failing_threshold) : 0.8;
    const sectionWeights =
      scoringSettings?.section_weights && typeof scoringSettings.section_weights === 'object'
        ? (scoringSettings.section_weights as Record<string, number>)
        : undefined;

    // 5. Calculate Score
    const scoringInput = {
      [MetricType.POSTS_DONE]: {
        target: effectiveTargets[MetricType.POSTS_DONE] || null,
        achieved: achievements.POSTS_DONE,
      },
      [MetricType.SALES_AMOUNT]: {
        target: effectiveTargets[MetricType.SALES_AMOUNT] || null,
        achieved: achievements.SALES_AMOUNT,
      },
      [MetricType.PROFIT_AMOUNT]: {
        target: effectiveTargets[MetricType.PROFIT_AMOUNT] || null,
        achieved: achievements.PROFIT_AMOUNT,
      },
      [MetricType.NEW_CLIENTS]: {
        target: effectiveTargets[MetricType.NEW_CLIENTS] || null,
        achieved: achievements.NEW_CLIENTS,
      },
      [MetricType.B2B_ORDERS]: {
        target: effectiveTargets[MetricType.B2B_ORDERS] || null,
        achieved: achievements.B2B_ORDERS,
      },
      [MetricType.RETENTION_COUNT]: {
        target: effectiveTargets[MetricType.RETENTION_COUNT] || null,
        achieved: achievements.RETENTION_COUNT,
      },
      [MetricType.FOLLOWUPS_DONE]: {
        target: effectiveTargets[MetricType.FOLLOWUPS_DONE] || null,
        achieved: achievements.FOLLOWUPS_DONE,
      },
    };

    const scoreResult = calculateEmployeeScore(scoringInput, {
      achievementCap: cap,
      failingThreshold,
      sectionWeights,
      lang,
    });

    // 6. Trend data: calculate last 14 days daily scores
    const trendDays: { date: string; score: number; sales: number; posts: number }[] = [];
    const todayDhaka = parseISO(getDhakaDateString());

    for (let i = 13; i >= 0; i--) {
      const dayDate = subDays(todayDhaka, i);
      const dayStr = format(dayDate, 'yyyy-MM-dd');
      const dayStart = parseDateOnly(dayStr);

      const dayEffectiveTargets = calculateEffectiveTargetsForRange(targets, dayStart, dayStart);
      const dayEntries = await prisma.dailyEntry.findMany({
        where: { employee_id: targetEmployeeId, entry_date: dayStart },
      });

      const dayStartUtc = new Date(`${dayStr}T00:00:00+06:00`);
      const dayEndUtc = new Date(`${dayStr}T23:59:59.999+06:00`);
      const dayPosts = await prisma.linkCompletion.count({
        where: {
          employee_id: targetEmployeeId,
          completed_at: { gte: dayStartUtc, lte: dayEndUtc },
          undone_at: null,
        },
      });

      const dayAch: Record<string, number> = {
        POSTS_DONE: dayPosts,
        SALES_AMOUNT: 0,
        PROFIT_AMOUNT: 0,
        NEW_CLIENTS: 0,
        B2B_ORDERS: 0,
        RETENTION_COUNT: 0,
        FOLLOWUPS_DONE: 0,
      };
      for (const e of dayEntries) {
        dayAch[e.metric_type] = Number(e.value);
      }

      const dayScoringInput = {
        [MetricType.POSTS_DONE]: { target: dayEffectiveTargets.POSTS_DONE || null, achieved: dayAch.POSTS_DONE },
        [MetricType.SALES_AMOUNT]: { target: dayEffectiveTargets.SALES_AMOUNT || null, achieved: dayAch.SALES_AMOUNT },
        [MetricType.PROFIT_AMOUNT]: { target: dayEffectiveTargets.PROFIT_AMOUNT || null, achieved: dayAch.PROFIT_AMOUNT },
        [MetricType.NEW_CLIENTS]: { target: dayEffectiveTargets.NEW_CLIENTS || null, achieved: dayAch.NEW_CLIENTS },
        [MetricType.B2B_ORDERS]: { target: dayEffectiveTargets.B2B_ORDERS || null, achieved: dayAch.B2B_ORDERS },
        [MetricType.RETENTION_COUNT]: { target: dayEffectiveTargets.RETENTION_COUNT || null, achieved: dayAch.RETENTION_COUNT },
        [MetricType.FOLLOWUPS_DONE]: { target: dayEffectiveTargets.FOLLOWUPS_DONE || null, achieved: dayAch.FOLLOWUPS_DONE },
      };

      const dayScore = calculateEmployeeScore(dayScoringInput, {
        achievementCap: cap,
        failingThreshold,
        sectionWeights,
      });

      trendDays.push({
        date: dayStr.slice(5), // MM-DD
        score: dayScore.totalScore,
        sales: dayAch.SALES_AMOUNT,
        posts: dayAch.POSTS_DONE,
      });
    }

    // 7. Product Breakdown over range
    const productSales = await prisma.dailyProductSale.findMany({
      where: {
        employee_id: targetEmployeeId,
        entry_date: { gte: startDate, lte: endDate },
      },
      include: { product: true },
    });

    const productTotals: Record<string, { name_bn: string; quantity: number; amount: number }> = {};
    for (const ps of productSales) {
      if (!productTotals[ps.product_id]) {
        productTotals[ps.product_id] = {
          name_bn: ps.product.name_bn,
          quantity: 0,
          amount: 0,
        };
      }
      productTotals[ps.product_id].quantity += Number(ps.quantity);
      productTotals[ps.product_id].amount += Number(ps.amount);
    }

    return NextResponse.json({
      period,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      assigned_sections: assignments.map((a) => a.section.name),
      score_result: scoreResult,
      trend: trendDays,
      product_sales: Object.values(productTotals),
    });
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}
