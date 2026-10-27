import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateTotalScore, calculateSectionScore, selectEmployeeTargets, readSectionWeights } from '@/lib/scoring';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import { MetricType } from '@prisma/client';
import { subDays, endOfMonth, parseISO, format } from 'date-fns';

export interface LeaderboardSectionScores {
  sales_profit: number;
  content: number;
  new_buyers_b2b: number;
  retention: number;
  inbox_followup: number;
}

export interface LeaderboardItem {
  rank: number;
  employee_id: string;
  name: string;
  total_score: number;
  section_scores: LeaderboardSectionScores;
  is_current_user?: boolean;
  gap_to_next?: number;
  gap_text?: string;
}

export async function GET(req: NextRequest) {
  try {
    // The gap label follows the language the user is reading the app in.
    const L = makeTranslator(readLangFromRequest(req));

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'EMPLOYEE' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'thisMonth';
    const todayStr = getDhakaDateString();

    let startDate: Date;
    let endDate: Date;

    if (period === 'today' || period === 'daily') {
      startDate = parseDateOnly(todayStr);
      endDate = startDate;
    } else if (period === 'yesterday') {
      const yestStr = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
      startDate = parseDateOnly(yestStr);
      endDate = startDate;
    } else if (period === 'last7days' || period === 'last7' || period === '7days') {
      const start7 = format(subDays(parseISO(todayStr), 6), 'yyyy-MM-dd');
      startDate = parseDateOnly(start7);
      endDate = parseDateOnly(todayStr);
    } else if (period === 'custom') {
      const startParam = searchParams.get('startDate') || searchParams.get('start_date');
      const endParam = searchParams.get('endDate') || searchParams.get('end_date');
      if (startParam && endParam && /^\d{4}-\d{2}-\d{2}$/.test(startParam) && /^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
        startDate = parseDateOnly(startParam);
        endDate = parseDateOnly(endParam);
      } else {
        startDate = parseDateOnly(`${todayStr.slice(0, 7)}-01`);
        endDate = parseDateOnly(format(endOfMonth(parseISO(todayStr)), 'yyyy-MM-dd'));
      }
    } else {
      // thisMonth (default)
      startDate = parseDateOnly(`${todayStr.slice(0, 7)}-01`);
      endDate = parseDateOnly(format(endOfMonth(parseISO(todayStr)), 'yyyy-MM-dd'));
    }

    // Targets are pro-rated over the whole range, so only compare against the days
    // that have happened: clamp the end to today in Dhaka.
    const todayDate = parseDateOnly(todayStr);
    if (endDate > todayDate) {
      endDate = todayDate < startDate ? startDate : todayDate;
    }

    // 1. Fetch active employees with their assigned sections
    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        is_active: true,
      },
      include: {
        assignments_as_employee: {
          select: { section_id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all section targets configured in system
    const allTargets = await prisma.sectionTarget.findMany();

    // 3. Date bounds for completions in Dhaka timezone (+06:00)
    const startUtc = new Date(`${format(startDate, 'yyyy-MM-dd')}T00:00:00+06:00`);
    const endUtc = new Date(`${format(endDate, 'yyyy-MM-dd')}T23:59:59.999+06:00`);

    // 4. Fetch all link completions in range
    const linkCompletions = await prisma.linkCompletion.findMany({
      where: {
        completed_at: { gte: startUtc, lte: endUtc },
        undone_at: null,
      },
      select: {
        employee_id: true,
      },
    });

    const postCounts: Record<string, number> = {};
    for (const lc of linkCompletions) {
      postCounts[lc.employee_id] = (postCounts[lc.employee_id] || 0) + 1;
    }

    // 5. Fetch all daily entries in range
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
        entry_date: { gte: startDate, lte: endDate },
      },
      select: {
        employee_id: true,
        metric_type: true,
        value: true,
      },
    });

    const employeeDailyMetrics: Record<string, Record<string, number>> = {};
    for (const entry of dailyEntries) {
      if (!employeeDailyMetrics[entry.employee_id]) {
        employeeDailyMetrics[entry.employee_id] = {};
      }
      const m = employeeDailyMetrics[entry.employee_id];
      m[entry.metric_type] = (m[entry.metric_type] || 0) + Number(entry.value);
    }

    // 6. Fetch Scoring Settings
    const scoringSettings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const cap = scoringSettings ? Number(scoringSettings.achievement_cap) : 1.0;
    const failingThreshold = scoringSettings ? Number(scoringSettings.failing_threshold) : 0.8;
    const sectionWeights = readSectionWeights(scoringSettings);

    // 7. Compute scores for each active employee
    const items: LeaderboardItem[] = employees.map((emp) => {
      const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
      const empTargets = selectEmployeeTargets(allTargets, emp.id, assignedSectionIds);
      const effectiveTargets = calculateEffectiveTargetsForRange(empTargets, startDate, endDate);

      const empDaily = employeeDailyMetrics[emp.id] || {};
      const postsDone = postCounts[emp.id] || 0;

      const scoringInput = {
        [MetricType.POSTS_DONE]: {
          target: effectiveTargets[MetricType.POSTS_DONE] || null,
          achieved: postsDone,
        },
        [MetricType.SALES_AMOUNT]: {
          target: effectiveTargets[MetricType.SALES_AMOUNT] || null,
          achieved: empDaily.SALES_AMOUNT || 0,
        },
        [MetricType.PROFIT_AMOUNT]: {
          target: effectiveTargets[MetricType.PROFIT_AMOUNT] || null,
          achieved: empDaily.PROFIT_AMOUNT || 0,
        },
        [MetricType.NEW_CLIENTS]: {
          target: effectiveTargets[MetricType.NEW_CLIENTS] || null,
          achieved: empDaily.NEW_CLIENTS || 0,
        },
        [MetricType.B2B_ORDERS]: {
          target: effectiveTargets[MetricType.B2B_ORDERS] || null,
          achieved: empDaily.B2B_ORDERS || 0,
        },
        [MetricType.RETENTION_COUNT]: {
          target: effectiveTargets[MetricType.RETENTION_COUNT] || null,
          achieved: empDaily.RETENTION_COUNT || 0,
        },
        [MetricType.FOLLOWUPS_DONE]: {
          target: effectiveTargets[MetricType.FOLLOWUPS_DONE] || null,
          achieved: empDaily.FOLLOWUPS_DONE || 0,
        },
      };

      const total_score = calculateTotalScore(scoringInput, {
        achievementCap: cap,
        failingThreshold,
        sectionWeights,
      });

      const section_scores: LeaderboardSectionScores = {
        sales_profit: calculateSectionScore('SALES_PROFIT', scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
        }),
        content: calculateSectionScore('CONTENT', scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
        }),
        new_buyers_b2b: calculateSectionScore('NEW_BUYERS_B2B', scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
        }),
        retention: calculateSectionScore('RETENTION', scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
        }),
        inbox_followup: calculateSectionScore('INBOX_FOLLOWUP', scoringInput, {
          achievementCap: cap,
          failingThreshold,
          sectionWeights,
        }),
      };

      return {
        rank: 0,
        employee_id: emp.id,
        name: emp.name,
        total_score: Number(total_score.toFixed(2)),
        section_scores,
        is_current_user: emp.id === session.userId,
      };
    });

    // 8. Sort array by total_score descending, tie-break by sales amount achieved, then name
    items.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      const salesB = employeeDailyMetrics[b.employee_id]?.SALES_AMOUNT || 0;
      const salesA = employeeDailyMetrics[a.employee_id]?.SALES_AMOUNT || 0;
      if (salesB !== salesA) {
        return salesB - salesA;
      }
      return a.name.localeCompare(b.name);
    });

    // Assign rank
    items.forEach((item, index) => {
      item.rank = index + 1;
    });

    // 9. Compute distance to next rank for each employee
    items.forEach((item, idx) => {
      let gap = 0;
      if (idx === 0) {
        // Rank 1: distance to rank 2 if exists
        if (items.length > 1) {
          gap = Number((items[0].total_score - items[1].total_score).toFixed(2));
        } else {
          gap = 0;
        }
      } else {
        // Rank > 1: distance to the rank above (idx - 1)
        gap = Number((items[idx - 1].total_score - item.total_score).toFixed(2));
      }
      item.gap_to_next = gap;
      item.gap_text = L(`আপনার পরের র্যাঙ্ক থেকে ব্যবধান: ${gap.toFixed(2)} পয়েন্ট`);
    });

    // Support both format=object and default array format
    if (searchParams.get('format') === 'object') {
      const currentEmp = items.find((i) => i.is_current_user);
      return NextResponse.json({
        period,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        leaderboard: items,
        my_rank: currentEmp?.rank ?? null,
        gap_to_next: currentEmp?.gap_to_next ?? 0,
        gap_text: currentEmp?.gap_text ?? '',
      });
    }

    // Default: returns array sorted by total points descending
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
  }
}
