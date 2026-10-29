import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import {
  calculateEmployeeScore,
  daysInRange,
  postsTargetWithLimitFallback,
  readSectionWeights,
  selectEmployeeTargets,
} from '@/lib/scoring';
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
    // A malformed date would make every date-fns call throw; fall back to today in Dhaka.
    const rawDate = searchParams.get('date');
    const dateParam =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isNaN(parseDateOnly(rawDate).getTime())
        ? rawDate
        : getDhakaDateString();

    let targetEmployeeId = session.userId;
    if (session.role === 'ADMIN' && searchParams.get('employee_id')) {
      targetEmployeeId = searchParams.get('employee_id')!;
    }

    // Determine date range in Dhaka. Bounds are UTC-midnight dates like DailyEntry.entry_date,
    // whatever the server's own timezone is.
    const refDate = parseISO(dateParam);
    const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
    let startDate: Date;
    let endDate: Date;

    if (period === 'daily') {
      startDate = parseDateOnly(dateParam);
      endDate = startDate;
    } else if (period === 'weekly') {
      startDate = parseDateOnly(ymd(startOfWeek(refDate, { weekStartsOn: 0 }))); // Sunday
      endDate = parseDateOnly(ymd(endOfWeek(refDate, { weekStartsOn: 0 })));
    } else {
      startDate = parseDateOnly(ymd(startOfMonth(refDate)));
      endDate = parseDateOnly(ymd(endOfMonth(refDate)));
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

    // No POSTS_DONE target: the daily section post limits stand in for one, for each day
    // in the range (the same rule the leaderboard and dashboard use).
    const postLimits = assignments.map((a) => a.post_limit);
    effectiveTargets[MetricType.POSTS_DONE] = postsTargetWithLimitFallback(
      effectiveTargets[MetricType.POSTS_DONE],
      postLimits,
      daysInRange(startDate, endDate)
    );

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
    const sectionWeights = readSectionWeights(scoringSettings);

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

    // 6. Trend data: calculate last 14 days daily scores (two reads for the whole window)
    const trendDays: { date: string; score: number; sales: number; posts: number }[] = [];
    const todayDhaka = parseISO(getDhakaDateString());
    const trendFirstStr = format(subDays(todayDhaka, 13), 'yyyy-MM-dd');
    const trendLastStr = format(todayDhaka, 'yyyy-MM-dd');
    const [trendEntries, trendCompletions] = await Promise.all([
      prisma.dailyEntry.findMany({
        where: {
          employee_id: targetEmployeeId,
          entry_date: { gte: parseDateOnly(trendFirstStr), lte: parseDateOnly(trendLastStr) },
        },
      }),
      prisma.linkCompletion.findMany({
        where: {
          employee_id: targetEmployeeId,
          completed_at: {
            gte: new Date(`${trendFirstStr}T00:00:00+06:00`),
            lte: new Date(`${trendLastStr}T23:59:59.999+06:00`),
          },
          undone_at: null,
        },
        select: { completed_at: true },
      }),
    ]);
    const postsByDay = new Map<string, number>();
    for (const c of trendCompletions) {
      const day = getDhakaDateString(new Date(c.completed_at));
      postsByDay.set(day, (postsByDay.get(day) || 0) + 1);
    }

    for (let i = 13; i >= 0; i--) {
      const dayDate = subDays(todayDhaka, i);
      const dayStr = format(dayDate, 'yyyy-MM-dd');
      const dayStart = parseDateOnly(dayStr);

      const dayEffectiveTargets = calculateEffectiveTargetsForRange(targets, dayStart, dayStart);
      dayEffectiveTargets.POSTS_DONE = postsTargetWithLimitFallback(dayEffectiveTargets.POSTS_DONE, postLimits, 1);

      const dayAch: Record<string, number> = {
        POSTS_DONE: postsByDay.get(dayStr) || 0,
        SALES_AMOUNT: 0,
        PROFIT_AMOUNT: 0,
        NEW_CLIENTS: 0,
        B2B_ORDERS: 0,
        RETENTION_COUNT: 0,
        FOLLOWUPS_DONE: 0,
      };
      for (const e of trendEntries) {
        // Posts come from link completions only; a POSTS_DONE daily entry is a manual note, not the count.
        if (e.metric_type === MetricType.POSTS_DONE) continue;
        if (new Date(e.entry_date).toISOString().slice(0, 10) !== dayStr) continue;
        dayAch[e.metric_type] = (dayAch[e.metric_type] || 0) + Number(e.value);
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
          name_bn: ps.product?.name_bn ?? '',
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
