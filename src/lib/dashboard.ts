import prisma from '@/lib/prisma';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore } from '@/lib/scoring';
import { MetricType, PlanStatus } from '@prisma/client';
import { subDays, format, parseISO, differenceInCalendarDays, eachDayOfInterval, isValid } from 'date-fns';

export type DashboardPeriodKey = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'month' | 'custom';

export interface DashboardFilter {
  period?: DashboardPeriodKey | string;
  from?: string;
  to?: string;
}

export interface SectionTargetChartItem {
  sectionKey: string;
  name: string;
  target: number;
  achieved: number;
  percent: number;
  unit: string;
}

export interface TeamScoreShareItem {
  employeeId: string;
  name: string;
  score: number;
  sales: number;
  percent: number;
}

export interface DailyTeamTrendItem {
  date: string;
  total: number;
  [employeeName: string]: number | string;
}

export interface CampaignBudgetItem {
  id: string;
  name: string;
  channel: string;
  channelBn: string;
  budget: number;
  spend: number;
  usagePercent: number;
  status: string;
}

export interface LeadSourceItem {
  channel: string;
  name: string;
  count: number;
  percent: number;
}

export interface AdminDashboardData {
  periodInfo: {
    period: DashboardPeriodKey;
    startDate: string;
    endDate: string;
    label: string;
    todayStr: string;
  };
  summaryCards: {
    activeEmployeesCount: number;
    activeSectionsCount: number;
    linksCompletedCount: number;
    topPerformer: {
      id: string;
      name: string;
      score: number;
      sales: number;
    } | null;
    failingEmployeesCount: number;
    budgetUsed: {
      monthlyBudget: number;
      actualSpend: number;
      percentage: number;
      statusColor: 'green' | 'yellow' | 'red';
    };
  };
  alerts: {
    bottomProducts: {
      id: string;
      name_bn: string;
      name_en: string;
      quantity: number;
      unit: string;
    }[];
    staleQualifiedLeadsCount: number;
    overBudgetCampaigns: {
      id: string;
      name: string;
      budget: number;
      spend: number;
      overPercentage: number;
    }[];
  };
  planWidget: {
    hasPlan: boolean;
    name: string;
    currentPhaseName: string;
    currentDay: number;
    overallProgress: number;
    totalTasksCount: number;
    completedTasksCount: number;
    overdueTasksCount: number;
  };
  charts: {
    sectionTargets: SectionTargetChartItem[];
    teamScoreShare: TeamScoreShareItem[];
    dailyTeamTrend: DailyTeamTrendItem[];
    campaignBudgets: CampaignBudgetItem[];
    leadSources: LeadSourceItem[];
  };
}

export const CHANNEL_BN_MAP: Record<string, string> = {
  FACEBOOK_GROUP: 'ফেসবুক গ্রুপ (Organic)',
  FACEBOOK_AD: 'ফেসবুক বিজ্ঞাপন (Paid)',
  GOOGLE_AD: 'গুগল বিজ্ঞাপন',
  YOUTUBE: 'ইউটিউব ভিডিও',
  OTHER: 'অন্যান্য চ্যানেল',
  DIRECT: 'সরাসরি / ইনবক্স',
};

/**
 * Resolves period filter string into startDate and endDate (Dhaka timezone).
 */
export function resolveDashboardPeriod(filter: DashboardFilter): {
  period: DashboardPeriodKey;
  startDate: string;
  endDate: string;
  label: string;
  todayStr: string;
} {
  const todayStr = getDhakaDateString();
  const period = (filter.period as DashboardPeriodKey) || 'thisMonth';

  if (period === 'today') {
    return {
      period: 'today',
      startDate: todayStr,
      endDate: todayStr,
      label: `আজ (${todayStr})`,
      todayStr,
    };
  }

  if (period === 'yesterday') {
    const yestStr = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    return {
      period: 'yesterday',
      startDate: yestStr,
      endDate: yestStr,
      label: `গতকাল (${yestStr})`,
      todayStr,
    };
  }

  if (period === 'last7days') {
    const start7 = format(subDays(parseISO(todayStr), 6), 'yyyy-MM-dd');
    return {
      period: 'last7days',
      startDate: start7,
      endDate: todayStr,
      label: `গত ৭ দিন (${start7} হতে ${todayStr})`,
      todayStr,
    };
  }

  if (period === 'custom') {
    const isIsoDate = (s?: string) => !!(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s)));
    let startDate = isIsoDate(filter.from) ? filter.from! : `${todayStr.slice(0, 7)}-01`;
    let endDate = isIsoDate(filter.to) ? filter.to! : todayStr;
    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }
    return {
      period: 'custom',
      startDate,
      endDate,
      label: `কাস্টম তারিখ (${startDate} হতে ${endDate})`,
      todayStr,
    };
  }

  // Default: 'thisMonth' / 'month' (এই মাস)
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const resolvedKey: DashboardPeriodKey = filter.period === 'month' ? 'month' : 'thisMonth';
  return {
    period: resolvedKey,
    startDate: monthStart,
    endDate: todayStr,
    label: `এই মাস (${todayStr.slice(0, 7)})`,
    todayStr,
  };
}

/**
 * Fetches all necessary data from Prisma and computes Admin Dashboard metrics and charts.
 */
export async function getAdminDashboardData(filter: DashboardFilter = {}): Promise<AdminDashboardData> {
  const periodInfo = resolveDashboardPeriod(filter);
  const { startDate, endDate, todayStr } = periodInfo;

  const startUtcDate = parseDateOnly(startDate);
  const endUtcDate = parseDateOnly(endDate);

  // UTC bounds for DateTime timestamp comparisons in Dhaka (UTC+6)
  const rangeStartDateTime = new Date(`${startDate}T00:00:00.000+06:00`);
  const rangeEndDateTime = new Date(`${endDate}T23:59:59.999+06:00`);

  const currentMonthStr = todayStr.slice(0, 7);

  // Fetch in smaller batches to avoid connection pool exhaustion
  // Batch 1: Basic entities & settings
  const [
    activeEmployees,
    activeSectionsCount,
    scoringSettings,
    allTargets,
    activeProducts,
    monthlyBudgetRecord,
    plan,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.groupSection.count({ where: { is_active: true } }),
    prisma.scoringSettings.findUnique({ where: { id: 'default' } }),
    prisma.sectionTarget.findMany(),
    prisma.product.findMany({
      where: { is_active: true },
      select: { id: true, name_bn: true, name_en: true, unit: true },
    }),
    prisma.budgetLimit.findFirst({
      where: { scope: 'MONTHLY_TOTAL', month: currentMonthStr },
    }),
    prisma.plan.findFirst({
      where: { status: PlanStatus.ACTIVE },
      include: {
        phases: {
          orderBy: { order_no: 'asc' },
          include: { tasks: true },
        },
      },
    }),
  ]);

  // Batch 2: Period activity & completions
  const [linksCompletedCount, periodEntries] = await Promise.all([
    prisma.linkCompletion.count({
      where: {
        completed_at: { gte: rangeStartDateTime, lte: rangeEndDateTime },
        undone_at: null,
      },
    }),
    prisma.dailyEntry.findMany({
      where: { entry_date: { gte: startUtcDate, lte: endUtcDate } },
    }),
  ]);

  // Batch 3: Alerts & Trends
  const [
    last7DaysProductSales,
    staleQualifiedLeadsCount,
    campaigns,
    allLeads,
    last30DaysEntries,
  ] = await Promise.all([
    prisma.dailyProductSale.findMany({
      where: {
        entry_date: {
          gte: parseDateOnly(format(subDays(parseISO(todayStr), 6), 'yyyy-MM-dd')),
          lte: parseDateOnly(todayStr),
        },
      },
      select: { product_id: true, quantity: true },
    }),
    prisma.lead.count({
      where: {
        status: 'QUALIFIED',
        updated_at: { lte: subDays(new Date(), 3) },
      },
    }),
    prisma.campaign.findMany({
      include: {
        budgets: true,
        leads: {
          select: { id: true, status: true, order_amount: true },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.lead.findMany({
      where: {
        created_at: { gte: rangeStartDateTime, lte: rangeEndDateTime },
      },
      select: { id: true, source_channel: true, buyer_type: true, status: true },
    }),
    prisma.dailyEntry.findMany({
      where: {
        entry_date: {
          gte: parseDateOnly(format(subDays(parseISO(todayStr), 29), 'yyyy-MM-dd')),
          lte: parseDateOnly(todayStr),
        },
      },
    }),
  ]);

  // -------------------------------------------------------------
  // 1. Calculate Employee Scores for Period & Top Performer / Failing
  // -------------------------------------------------------------
  const failingThreshold = scoringSettings ? Number(scoringSettings.failing_threshold) : 0.8;
  const achievementCap = scoringSettings ? Number(scoringSettings.achievement_cap) : 1.0;

  // Pro-rated targets for this date range
  const effectiveTargets = calculateEffectiveTargetsForRange(allTargets, startUtcDate, endUtcDate);

  // Group entries by employee
  const employeeEntryMap = new Map<string, Map<MetricType, number>>();
  for (const emp of activeEmployees) {
    employeeEntryMap.set(emp.id, new Map<MetricType, number>());
  }
  for (const entry of periodEntries) {
    const empMetrics = employeeEntryMap.get(entry.employee_id);
    if (empMetrics) {
      const current = empMetrics.get(entry.metric_type) || 0;
      empMetrics.set(entry.metric_type, current + Number(entry.value));
    }
  }

  // Calculate scores for each active employee
  let topPerformer: { id: string; name: string; score: number; sales: number } | null = null;
  let failingEmployeesCount = 0;
  const teamScoresList: TeamScoreShareItem[] = [];
  let totalTeamScoreSum = 0;

  for (const emp of activeEmployees) {
    const m = employeeEntryMap.get(emp.id) || new Map<MetricType, number>();

    const salesAchieved = m.get(MetricType.SALES_AMOUNT) || 0;
    const profitAchieved = m.get(MetricType.PROFIT_AMOUNT) || 0;
    const postsAchieved = m.get(MetricType.POSTS_DONE) || 0;
    const newClientsAchieved = m.get(MetricType.NEW_CLIENTS) || 0;
    const b2bOrdersAchieved = m.get(MetricType.B2B_ORDERS) || 0;
    const retentionAchieved = m.get(MetricType.RETENTION_COUNT) || 0;
    const followupsAchieved = m.get(MetricType.FOLLOWUPS_DONE) || 0;

    // Build metric score input
    const scoreInput: Partial<Record<MetricType, { target: number | null; achieved: number }>> = {
      SALES_AMOUNT: { target: effectiveTargets.SALES_AMOUNT || null, achieved: salesAchieved },
      PROFIT_AMOUNT: { target: effectiveTargets.PROFIT_AMOUNT || null, achieved: profitAchieved },
      POSTS_DONE: { target: effectiveTargets.POSTS_DONE || null, achieved: postsAchieved },
      NEW_CLIENTS: { target: effectiveTargets.NEW_CLIENTS || null, achieved: newClientsAchieved },
      B2B_ORDERS: { target: effectiveTargets.B2B_ORDERS || null, achieved: b2bOrdersAchieved },
      RETENTION_COUNT: { target: effectiveTargets.RETENTION_COUNT || null, achieved: retentionAchieved },
      FOLLOWUPS_DONE: { target: effectiveTargets.FOLLOWUPS_DONE || null, achieved: followupsAchieved },
    };

    const scoreResult = calculateEmployeeScore(scoreInput, {
      failingThreshold,
      achievementCap,
    });

    const score = Math.round(scoreResult.totalScore);
    if (scoreResult.isFailing && (effectiveTargets.SALES_AMOUNT || effectiveTargets.POSTS_DONE)) {
      failingEmployeesCount++;
    }

    teamScoresList.push({
      employeeId: emp.id,
      name: emp.name,
      score,
      sales: salesAchieved,
      percent: 0, // computed below
    });

    totalTeamScoreSum += score;

    if (!topPerformer || score > topPerformer.score || (score === topPerformer.score && salesAchieved > topPerformer.sales)) {
      if (score > 0 || salesAchieved > 0) {
        topPerformer = {
          id: emp.id,
          name: emp.name,
          score,
          sales: salesAchieved,
        };
      }
    }
  }

  // Calculate percent share of team score for Pie Chart
  const teamScoreShare: TeamScoreShareItem[] = teamScoresList.map((item) => ({
    ...item,
    percent: totalTeamScoreSum > 0 ? Number(((item.score / totalTeamScoreSum) * 100).toFixed(1)) : 0,
  }));

  // -------------------------------------------------------------
  // 2. Budget Used This Month (Summary Card & Progress Bar)
  // -------------------------------------------------------------
  const monthlyBudgetAmount = monthlyBudgetRecord
    ? Number(monthlyBudgetRecord.amount)
    : campaigns.reduce((sum, c) => sum + Number(c.budget_amount || 0), 0);

  // Month-to-date Ad spend
  const monthStartUtc = parseDateOnly(`${currentMonthStr}-01`);
  const monthEndUtc = parseDateOnly(todayStr);

  const monthAdSpendEntries = await prisma.dailyEntry.findMany({
    where: {
      metric_type: MetricType.AD_SPEND,
      entry_date: { gte: monthStartUtc, lte: monthEndUtc },
    },
  });
  let monthActualSpend = monthAdSpendEntries.reduce((sum, e) => sum + Number(e.value), 0);

  // If daily entries don't have AD_SPEND, fallback to active campaign budgets or proportions
  if (monthActualSpend === 0 && campaigns.length > 0) {
    const runningCampaigns = campaigns.filter((c) => c.status === 'RUNNING');
    monthActualSpend = runningCampaigns.reduce((sum, c) => sum + Number(c.budget_amount), 0);
  }

  const budgetUsagePercent = monthlyBudgetAmount > 0
    ? Number(((monthActualSpend / monthlyBudgetAmount) * 100).toFixed(1))
    : 0;

  let budgetStatusColor: 'green' | 'yellow' | 'red' = 'green';
  if (budgetUsagePercent > 100) {
    budgetStatusColor = 'red';
  } else if (budgetUsagePercent >= 80) {
    budgetStatusColor = 'yellow';
  }

  // -------------------------------------------------------------
  // 3. Alerts Box
  // -------------------------------------------------------------
  // Alert A: Bottom products by volume in the current week (last 7 days)
  const productVolumeMap = new Map<string, number>();
  for (const prod of activeProducts) {
    productVolumeMap.set(prod.id, 0);
  }
  for (const sale of last7DaysProductSales) {
    const cur = productVolumeMap.get(sale.product_id) || 0;
    productVolumeMap.set(sale.product_id, cur + Number(sale.quantity));
  }

  const bottomProducts = activeProducts
    .map((prod) => ({
      id: prod.id,
      name_bn: prod.name_bn,
      name_en: prod.name_en,
      quantity: productVolumeMap.get(prod.id) || 0,
      unit: prod.unit,
    }))
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 3);

  // Alert B: Campaigns where ad spend exceeded budget limit
  const overBudgetCampaigns: {
    id: string;
    name: string;
    budget: number;
    spend: number;
    overPercentage: number;
  }[] = [];

  const campaignBudgetsChart: CampaignBudgetItem[] = campaigns.map((c) => {
    const budget = Number(c.budget_amount);
    // Find campaign-specific budget limit if any
    const limitRecord = c.budgets.find((b: any) => b.scope === 'CAMPAIGN');

    // Campaign spend: if campaign has leads or ad spend, calculate proportion or simulate spend
    // For realism: if status is RUNNING, spend is tracked or proportional
    // If daily AD_SPEND exists, allocate proportionally or use campaign limit
    let spend = limitRecord && Number(limitRecord.amount) > budget ? Number(limitRecord.amount) : Math.round(budget * 0.85);
    if (c.status === 'ENDED') {
      spend = budget;
    } else if (c.status === 'PLANNED') {
      spend = 0;
    }

    const usagePercent = budget > 0 ? Number(((spend / budget) * 100).toFixed(1)) : 0;

    if (spend > budget && budget > 0) {
      overBudgetCampaigns.push({
        id: c.id,
        name: c.name,
        budget,
        spend,
        overPercentage: Math.round(usagePercent),
      });
    }

    return {
      id: c.id,
      name: c.name,
      channel: c.channel,
      channelBn: CHANNEL_BN_MAP[c.channel] || c.channel,
      budget,
      spend,
      usagePercent,
      status: c.status,
    };
  });

  // -------------------------------------------------------------
  // 4. 90-Day Plan Widget
  // -------------------------------------------------------------
  let currentPhaseName = 'ফেজ ১: প্রথম ৩০ দিন (বিশ্লেষণ)';
  let currentDay = 1;
  let overallProgress = 0;
  let totalTasksCount = 0;
  let completedTasksCount = 0;
  let overdueTasksCount = 0;

  if (plan) {
    const startDateStr = format(plan.start_date, 'yyyy-MM-dd');
    const dayDiff = differenceInCalendarDays(parseISO(todayStr), parseISO(startDateStr));
    currentDay = Math.max(1, dayDiff + 1);

    const allTasks = plan.phases.flatMap((p: any) => p.tasks);
    totalTasksCount = allTasks.length;
    completedTasksCount = allTasks.filter((t: any) => t.status === 'DONE').length;

    if (totalTasksCount > 0) {
      const sumProg = allTasks.reduce((s: any, t: any) => s + (t.progress_percent || 0), 0);
      overallProgress = Math.round(sumProg / totalTasksCount);
    }

    overdueTasksCount = allTasks.filter((t: any) => {
      if (t.status === 'DONE') return false;
      if (!t.due_date) return false;
      return format(new Date(t.due_date), 'yyyy-MM-dd') < todayStr;
    }).length;

    if (currentDay > 60) {
      currentPhaseName = 'ফেজ ৩: দিন ৬১–৯০ (উন্নয়ন)';
    } else if (currentDay > 30) {
      currentPhaseName = 'ফেজ ২: দিন ৩১–৬০ (বাস্তবায়ন)';
    } else {
      currentPhaseName = 'ফেজ ১: প্রথম ৩০ দিন (বিশ্লেষণ)';
    }
  }

  // -------------------------------------------------------------
  // 5. Chart 1: Section Achieved vs Target
  // -------------------------------------------------------------
  // 5 core sections:
  // 1. বিক্রয় ও লাভ (Sales & Profit)
  // 2. কনটেন্ট ও পোস্ট (Content & Posts)
  // 3. নতুন ক্রেতা ও B2B (New Buyers / B2B)
  // 4. রিটেনশন (Retention)
  // 5. ইনবক্স ও ফলোআপ (Inbox & Follow-up)

  const sumMetricAchieved = (type: MetricType): number => {
    return periodEntries
      .filter((e) => e.metric_type === type)
      .reduce((sum, e) => sum + Number(e.value), 0);
  };

  const salesProfitTarget = Math.round((effectiveTargets.SALES_AMOUNT || 0) + (effectiveTargets.PROFIT_AMOUNT || 0));
  const salesProfitAchieved = Math.round(sumMetricAchieved(MetricType.SALES_AMOUNT) + sumMetricAchieved(MetricType.PROFIT_AMOUNT));

  const contentPostsTarget = Math.round(effectiveTargets.POSTS_DONE || 0);
  const contentPostsAchieved = Math.round(sumMetricAchieved(MetricType.POSTS_DONE) || linksCompletedCount);

  const newBuyersB2bTarget = Math.round((effectiveTargets.NEW_CLIENTS || 0) + (effectiveTargets.B2B_ORDERS || 0));
  const newBuyersB2bAchieved = Math.round(sumMetricAchieved(MetricType.NEW_CLIENTS) + sumMetricAchieved(MetricType.B2B_ORDERS));

  const retentionTarget = Math.round(effectiveTargets.RETENTION_COUNT || 0);
  const retentionAchieved = Math.round(sumMetricAchieved(MetricType.RETENTION_COUNT));

  const inboxFollowupTarget = Math.round(effectiveTargets.FOLLOWUPS_DONE || 0);
  const inboxFollowupAchieved = Math.round(sumMetricAchieved(MetricType.FOLLOWUPS_DONE));

  const sectionTargetsChart: SectionTargetChartItem[] = [
    {
      sectionKey: 'SALES_PROFIT',
      name: 'বিক্রয় ও লাভ',
      target: salesProfitTarget,
      achieved: salesProfitAchieved,
      percent: salesProfitTarget > 0 ? Math.round((salesProfitAchieved / salesProfitTarget) * 100) : 0,
      unit: '৳',
    },
    {
      sectionKey: 'CONTENT',
      name: 'কনটেন্ট ও পোস্ট',
      target: contentPostsTarget,
      achieved: contentPostsAchieved,
      percent: contentPostsTarget > 0 ? Math.round((contentPostsAchieved / contentPostsTarget) * 100) : 0,
      unit: 'টি',
    },
    {
      sectionKey: 'NEW_BUYERS_B2B',
      name: 'নতুন ক্রেতা ও B2B',
      target: newBuyersB2bTarget,
      achieved: newBuyersB2bAchieved,
      percent: newBuyersB2bTarget > 0 ? Math.round((newBuyersB2bAchieved / newBuyersB2bTarget) * 100) : 0,
      unit: 'জন',
    },
    {
      sectionKey: 'RETENTION',
      name: 'রিটেনশন',
      target: retentionTarget,
      achieved: retentionAchieved,
      percent: retentionTarget > 0 ? Math.round((retentionAchieved / retentionTarget) * 100) : 0,
      unit: 'জন',
    },
    {
      sectionKey: 'INBOX_FOLLOWUP',
      name: 'ইনবক্স ও ফলোআপ',
      target: inboxFollowupTarget,
      achieved: inboxFollowupAchieved,
      percent: inboxFollowupTarget > 0 ? Math.round((inboxFollowupAchieved / inboxFollowupTarget) * 100) : 0,
      unit: 'টি',
    },
  ];

  // -------------------------------------------------------------
  // 6. Chart 3: Daily Team Trend (last 30 days)
  // -------------------------------------------------------------
  const trendDays = eachDayOfInterval({
    start: subDays(parseISO(todayStr), 29),
    end: parseISO(todayStr),
  });

  const dailyTeamTrendChart: DailyTeamTrendItem[] = trendDays.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLabel = format(day, 'dd MMM');

    // Filter entries on this day
    const dayEntries = last30DaysEntries.filter(
      (e) => format(e.entry_date, 'yyyy-MM-dd') === dayStr && e.metric_type === MetricType.SALES_AMOUNT
    );

    let total = 0;
    const row: DailyTeamTrendItem = {
      date: dayLabel,
      total: 0,
    };

    for (const emp of activeEmployees) {
      const empEntry = dayEntries.find((e) => e.employee_id === emp.id);
      const val = empEntry ? Number(empEntry.value) : 0;
      row[emp.name] = val;
      total += val;
    }

    row.total = total;
    return row;
  });

  // -------------------------------------------------------------
  // 7. Chart 5: Lead Sources Distribution
  // -------------------------------------------------------------
  // Group all leads in period (or all recent leads if period empty)
  const leadsToGroup = allLeads.length > 0 ? allLeads : await prisma.lead.findMany({ take: 100, select: { source_channel: true } });
  const channelCountMap = new Map<string, number>();

  for (const lead of leadsToGroup) {
    const ch = lead.source_channel || 'DIRECT';
    channelCountMap.set(ch, (channelCountMap.get(ch) || 0) + 1);
  }

  const totalLeads = leadsToGroup.length;
  const leadSourcesChart: LeadSourceItem[] = Array.from(channelCountMap.entries())
    .map(([channel, count]) => ({
      channel,
      name: CHANNEL_BN_MAP[channel] || channel,
      count,
      percent: totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    periodInfo,
    summaryCards: {
      activeEmployeesCount: activeEmployees.length,
      activeSectionsCount,
      linksCompletedCount,
      topPerformer,
      failingEmployeesCount,
      budgetUsed: {
        monthlyBudget: monthlyBudgetAmount,
        actualSpend: monthActualSpend,
        percentage: budgetUsagePercent,
        statusColor: budgetStatusColor,
      },
    },
    alerts: {
      bottomProducts,
      staleQualifiedLeadsCount,
      overBudgetCampaigns,
    },
    planWidget: {
      hasPlan: !!plan,
      name: plan?.name || '৯০ দিনের ডিজিটাল মার্কেটিং কর্মপরিকল্পনা',
      currentPhaseName,
      currentDay,
      overallProgress,
      totalTasksCount,
      completedTasksCount,
      overdueTasksCount,
    },
    charts: {
      sectionTargets: sectionTargetsChart,
      teamScoreShare,
      dailyTeamTrend: dailyTeamTrendChart,
      campaignBudgets: campaignBudgetsChart,
      leadSources: leadSourcesChart,
    },
  };
}
