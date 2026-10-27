import prisma from '@/lib/prisma';
import { getDhakaDateString, parseDateOnly, formatDhakaDateTime } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore } from '@/lib/scoring';
import { makeTranslator, type Lang } from '@/lib/i18n/translate';
import { MetricType, PlanStatus } from '@prisma/client';
import { subDays, format, parseISO, differenceInCalendarDays, eachDayOfInterval, isValid } from 'date-fns';

export type DashboardPeriodKey = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'month' | 'custom';

export interface DashboardFilter {
  period?: DashboardPeriodKey | string;
  from?: string;
  to?: string;
  employeeId?: string;
  sectionKey?: string;
  /** Language for the display labels in the result. Defaults to Bangla. */
  lang?: Lang;
}

export type SectionOverviewKey =
  | 'POSTS_DONE'
  | 'NEW_LEADS'
  | 'CONFIRMED_ORDERS'
  | 'SALES_AMOUNT'
  | 'NEW_CLIENTS'
  | 'FOLLOWUPS_DONE'
  | 'PROFIT_AMOUNT';

export interface EmployeeSectionBreakdown {
  employeeId: string;
  name: string;
  email: string;
  total: number;
  target: number;
  percentage: number;
  hasTarget: boolean;
  bankedSurplus?: number;
  consumed?: number;
}

export interface SectionHistoryLog {
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  value: number;
  note?: string;
}

export interface SectionOverviewItem {
  key: SectionOverviewKey;
  labelBn: string;
  labelEn: string;
  unitBn: string;
  unitEn: string;
  iconName: string;
  isCurrency: boolean;
  totalAchieved: number;
  totalTarget: number;
  activeEmployeesCount: number;
  assignedEmployeesCount: number;
  averagePercentage: number;
  employeeBreakdown: EmployeeSectionBreakdown[];
  historyLogs: SectionHistoryLog[];
}

export interface GroupLinkCompletionHistoryItem {
  date: string;
  employeeName: string;
  employeeId: string;
  linkUrl: string;
  linkTitle?: string;
}

export interface GroupSectionOverviewItem {
  id: string;
  name: string;
  totalLinks: number;
  completedLinksCount: number;
  assignedEmployeesCount: number;
  averagePercentage: number;
  employeeBreakdown: EmployeeSectionBreakdown[];
  completionsHistory: GroupLinkCompletionHistoryItem[];
}

export interface EmployeeWorkMetrics {
  posts_done: number;
  orders_confirmed: number;
  messages_replied: number;
  leads_collected: number;
  sales_amount: number;
}

export interface EmployeeDailyWorkHistoryItem {
  date: string;
  posts_done: number;
  orders_confirmed: number;
  messages_replied: number;
  leads_collected: number;
  sales_amount: number;
  note?: string;
}

export interface EmployeeWorkSummaryItem {
  id: string;
  name: string;
  email: string;
  metrics: EmployeeWorkMetrics;
  targetProgressPercent: number;
  history: EmployeeDailyWorkHistoryItem[];
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
  sectionsOverview: SectionOverviewItem[];
  groupSectionsOverview: GroupSectionOverviewItem[];
  employeeWorkSummary: EmployeeWorkSummaryItem[];
}

export const SECTION_METRIC_CONFIG: Record<
  SectionOverviewKey,
  {
    metricType: MetricType;
    labelBn: string;
    labelEn: string;
    unitBn: string;
    unitEn: string;
    iconName: string;
    isCurrency: boolean;
  }
> = {
  POSTS_DONE: {
    metricType: MetricType.POSTS_DONE,
    labelBn: 'গ্রুপ পোস্ট / লিংক সম্পন্ন',
    labelEn: 'Group Links / Posts Done',
    unitBn: 'টি',
    unitEn: 'links',
    iconName: 'Share2',
    isCurrency: false,
  },
  NEW_LEADS: {
    metricType: MetricType.NEW_LEADS,
    labelBn: 'নতুন লিড সংগ্রহ',
    labelEn: 'New Leads Collected',
    unitBn: 'টি',
    unitEn: 'leads',
    iconName: 'UserPlus',
    isCurrency: false,
  },
  CONFIRMED_ORDERS: {
    metricType: MetricType.CONFIRMED_ORDERS,
    labelBn: 'কনফার্মড অর্ডার',
    labelEn: 'Confirmed Orders',
    unitBn: 'টি',
    unitEn: 'orders',
    iconName: 'ShoppingBag',
    isCurrency: false,
  },
  SALES_AMOUNT: {
    metricType: MetricType.SALES_AMOUNT,
    labelBn: 'মোট বিক্রয়',
    labelEn: 'Total Sales',
    unitBn: '৳',
    unitEn: 'BDT',
    iconName: 'DollarSign',
    isCurrency: true,
  },
  NEW_CLIENTS: {
    metricType: MetricType.NEW_CLIENTS,
    labelBn: 'নতুন ক্রেতা',
    labelEn: 'New Clients',
    unitBn: 'জন',
    unitEn: 'clients',
    iconName: 'Users',
    isCurrency: false,
  },
  FOLLOWUPS_DONE: {
    metricType: MetricType.FOLLOWUPS_DONE,
    labelBn: 'ইনবক্স ফলো-আপ',
    labelEn: 'Inbox Follow-ups',
    unitBn: 'টি',
    unitEn: 'follow-ups',
    iconName: 'MessageSquare',
    isCurrency: false,
  },
  PROFIT_AMOUNT: {
    metricType: MetricType.PROFIT_AMOUNT,
    labelBn: 'মোট মুনাফা',
    labelEn: 'Total Profit',
    unitBn: '৳',
    unitEn: 'BDT',
    iconName: 'TrendingUp',
    isCurrency: true,
  },
};

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
  const L = makeTranslator(filter.lang ?? 'bn');
  const todayStr = getDhakaDateString();
  const period = (filter.period as DashboardPeriodKey) || 'thisMonth';

  if (period === 'today') {
    return {
      period: 'today',
      startDate: todayStr,
      endDate: todayStr,
      label: L(`আজ (${todayStr})`),
      todayStr,
    };
  }

  if (period === 'yesterday') {
    const yestStr = format(subDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    return {
      period: 'yesterday',
      startDate: yestStr,
      endDate: yestStr,
      label: L(`গতকাল (${yestStr})`),
      todayStr,
    };
  }

  if (period === 'last7days') {
    const start7 = format(subDays(parseISO(todayStr), 6), 'yyyy-MM-dd');
    return {
      period: 'last7days',
      startDate: start7,
      endDate: todayStr,
      label: L(`গত ৭ দিন (${start7} হতে ${todayStr})`),
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
      label: L(`কাস্টম তারিখ (${startDate} হতে ${endDate})`),
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
    label: L(`এই মাস (${todayStr.slice(0, 7)})`),
    todayStr,
  };
}

/**
 * Fetches all necessary data from Prisma and computes Admin Dashboard metrics and charts.
 */
export async function getAdminDashboardData(filter: DashboardFilter = {}): Promise<AdminDashboardData> {
  // Display labels follow the caller's language; stored data is never translated.
  const lang: Lang = filter.lang ?? 'bn';
  const L = makeTranslator(lang);
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
    allGroupSections,
    allGroupLinks,
    assignments,
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
    prisma.groupSection.findMany({
      where: { is_active: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    }),
    prisma.groupLink.findMany({
      where: { is_active: true },
      select: { id: true, section_id: true, url: true, title: true },
    }),
    prisma.assignment.findMany({
      select: { employee_id: true, section_id: true, post_limit: true },
    }),
  ]);

  // Batch 2: Period activity & completions
  const [linksCompletedCount, periodEntries, periodLinkCompletions, periodDailyTexts] = await Promise.all([
    prisma.linkCompletion.count({
      where: {
        completed_at: { gte: rangeStartDateTime, lte: rangeEndDateTime },
        undone_at: null,
        ...(filter.employeeId ? { employee_id: filter.employeeId } : {}),
      },
    }),
    prisma.dailyEntry.findMany({
      where: {
        entry_date: { gte: startUtcDate, lte: endUtcDate },
        ...(filter.employeeId ? { employee_id: filter.employeeId } : {}),
      },
    }),
    prisma.linkCompletion.findMany({
      where: {
        completed_at: { gte: rangeStartDateTime, lte: rangeEndDateTime },
        undone_at: null,
        ...(filter.employeeId ? { employee_id: filter.employeeId } : {}),
      },
      select: {
        id: true,
        group_link_id: true,
        employee_id: true,
        completed_at: true,
      },
      orderBy: { completed_at: 'desc' },
    }),
    prisma.dailyText.findMany({
      where: {
        entry_date: { gte: startUtcDate, lte: endUtcDate },
        ...(filter.employeeId ? { employee_id: filter.employeeId } : {}),
      },
      select: { employee_id: true, entry_date: true, main_issue: true, next_priorities: true },
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
        ...(filter.employeeId ? { owner_id: filter.employeeId } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        source_channel: true,
        buyer_type: true,
        status: true,
        owner_id: true,
        created_at: true,
      },
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
      channelBn: L(CHANNEL_BN_MAP[c.channel] || c.channel),
      budget,
      spend,
      usagePercent,
      status: c.status,
    };
  });

  // -------------------------------------------------------------
  // 4. 90-Day Plan Widget
  // -------------------------------------------------------------
  let currentPhaseName = L('ফেজ ১: প্রথম ৩০ দিন (বিশ্লেষণ)');
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
      currentPhaseName = L('ফেজ ৩: দিন ৬১–৯০ (উন্নয়ন)');
    } else if (currentDay > 30) {
      currentPhaseName = L('ফেজ ২: দিন ৩১–৬০ (বাস্তবায়ন)');
    } else {
      currentPhaseName = L('ফেজ ১: প্রথম ৩০ দিন (বিশ্লেষণ)');
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
      name: L('বিক্রয় ও লাভ'),
      target: salesProfitTarget,
      achieved: salesProfitAchieved,
      percent: salesProfitTarget > 0 ? Math.round((salesProfitAchieved / salesProfitTarget) * 100) : 0,
      unit: '৳',
    },
    {
      sectionKey: 'CONTENT',
      name: L('কনটেন্ট ও পোস্ট'),
      target: contentPostsTarget,
      achieved: contentPostsAchieved,
      percent: contentPostsTarget > 0 ? Math.round((contentPostsAchieved / contentPostsTarget) * 100) : 0,
      unit: 'টি',
    },
    {
      sectionKey: 'NEW_BUYERS_B2B',
      name: L('নতুন ক্রেতা ও B2B'),
      target: newBuyersB2bTarget,
      achieved: newBuyersB2bAchieved,
      percent: newBuyersB2bTarget > 0 ? Math.round((newBuyersB2bAchieved / newBuyersB2bTarget) * 100) : 0,
      unit: 'জন',
    },
    {
      sectionKey: 'RETENTION',
      name: L('রিটেনশন'),
      target: retentionTarget,
      achieved: retentionAchieved,
      percent: retentionTarget > 0 ? Math.round((retentionAchieved / retentionTarget) * 100) : 0,
      unit: 'জন',
    },
    {
      sectionKey: 'INBOX_FOLLOWUP',
      name: L('ইনবক্স ও ফলোআপ'),
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
      name: L(CHANNEL_BN_MAP[channel] || channel),
      count,
      percent: totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // -------------------------------------------------------------
  // 8. Work Sections Overview & Employee Drilldown
  // -------------------------------------------------------------
  const sectionsOverview = computeSectionsOverview({
    lang,
    activeEmployees,
    allTargets,
    effectiveTargets,
    assignments,
    periodEntries,
    periodLinkCompletions,
    periodLeads: allLeads,
    startUtcDate,
    endUtcDate,
    filterSectionKey: filter.sectionKey,
    filterEmployeeId: filter.employeeId,
  });

  const groupSectionsOverview = computeGroupSectionsOverview({
    allGroupSections,
    allGroupLinks,
    periodLinkCompletions,
    activeEmployees,
    assignments,
    allTargets,
    startUtcDate,
    endUtcDate,
    filterEmployeeId: filter.employeeId,
  });

  const employeeWorkSummary = computeEmployeeWorkSummary({
    activeEmployees,
    allTargets,
    effectiveTargets,
    assignments,
    periodEntries,
    periodLinkCompletions,
    periodDailyTexts,
    startUtcDate,
    endUtcDate,
    filterEmployeeId: filter.employeeId,
  });

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
      name: plan?.name || L('৯০ দিনের ডিজিটাল মার্কেটিং কর্মপরিকল্পনা'),
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
    sectionsOverview,
    groupSectionsOverview,
    employeeWorkSummary,
  };
}

/**
 * Normalizes Date or date string to YYYY-MM-DD in Asia/Dhaka.
 */
export function toDhakaDateKey(d: Date | string): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return getDhakaDateString(d);
}

/**
 * Computes sectionsOverview for the 5 primary work sections.
 */
export function computeSectionsOverview(params: {
  /** Language for the generated history notes. Defaults to Bangla. */
  lang?: Lang;
  activeEmployees: Array<{ id: string; name: string; email: string }>;
  allTargets: any[];
  effectiveTargets: Record<MetricType, number>;
  assignments: Array<{ employee_id: string; section_id: string }>;
  periodEntries: any[];
  periodLinkCompletions: any[];
  periodLeads?: any[];
  startUtcDate: Date;
  endUtcDate: Date;
  filterSectionKey?: string;
  filterEmployeeId?: string;
}): SectionOverviewItem[] {
  const {
    lang,
    activeEmployees,
    allTargets,
    effectiveTargets,
    assignments,
    periodEntries,
    periodLinkCompletions,
    periodLeads = [],
    startUtcDate,
    endUtcDate,
    filterSectionKey,
    filterEmployeeId,
  } = params;
  const L = makeTranslator(lang ?? 'bn');

  const scopedEmployees = filterEmployeeId
    ? activeEmployees.filter((e) => e.id === filterEmployeeId)
    : activeEmployees;

  const employeeMap = new Map<string, { id: string; name: string; email: string }>();
  for (const emp of activeEmployees) {
    employeeMap.set(emp.id, emp);
  }

  // Pre-index completions by "employeeId_dateStr"
  const completionsByEmpDate = new Map<string, number>();
  for (const c of periodLinkCompletions) {
    const dStr = getDhakaDateString(new Date(c.completed_at));
    const key = `${c.employee_id}_${dStr}`;
    completionsByEmpDate.set(key, (completionsByEmpDate.get(key) || 0) + 1);
  }

  // Pre-index daily entries by "employeeId_dateStr_metricType"
  const dailyEntriesByEmpDateMetric = new Map<string, { value: number; note?: string }>();
  for (const e of periodEntries) {
    const dStr = toDhakaDateKey(e.entry_date);
    const key = `${e.employee_id}_${dStr}_${e.metric_type}`;
    dailyEntriesByEmpDateMetric.set(key, {
      value: Number(e.value),
      note: e.note || undefined,
    });
  }

  const sectionKeys: SectionOverviewKey[] = [
    'POSTS_DONE',
    'NEW_LEADS',
    'CONFIRMED_ORDERS',
    'SALES_AMOUNT',
    'NEW_CLIENTS',
    'FOLLOWUPS_DONE',
    'PROFIT_AMOUNT',
  ];

  const result: SectionOverviewItem[] = [];

  for (const secKey of sectionKeys) {
    if (filterSectionKey && filterSectionKey !== secKey) {
      continue;
    }

    const config = SECTION_METRIC_CONFIG[secKey];
    const metricType = config.metricType;

    const historyLogs: SectionHistoryLog[] = [];
    const empTotals = new Map<string, number>();

    if (secKey === 'POSTS_DONE') {
      // POSTS_DONE can come from LinkCompletion or DailyEntry
      const allPostKeys = new Set<string>();
      for (const [k] of completionsByEmpDate) {
        allPostKeys.add(k);
      }
      for (const e of periodEntries) {
        if (e.metric_type === MetricType.POSTS_DONE) {
          const dStr = toDhakaDateKey(e.entry_date);
          allPostKeys.add(`${e.employee_id}_${dStr}`);
        }
      }

      for (const key of allPostKeys) {
        const [empId, dateStr] = key.split('_');
        const compCount = completionsByEmpDate.get(key) || 0;
        const entryData = dailyEntriesByEmpDateMetric.get(`${empId}_${dateStr}_${MetricType.POSTS_DONE}`);
        const entryVal = entryData ? entryData.value : 0;
        const achieved = Math.max(compCount, entryVal);

        if (achieved > 0) {
          const emp = employeeMap.get(empId);
          historyLogs.push({
            date: dateStr,
            employeeId: empId,
            employeeName: emp ? emp.name : 'Unknown',
            value: achieved,
            note: entryData?.note,
          });
          empTotals.set(empId, (empTotals.get(empId) || 0) + achieved);
        }
      }
    } else if (secKey === 'NEW_CLIENTS') {
      // NEW_CLIENTS from customer / client profiles created + DailyEntry
      const leadsCountByEmp = new Map<string, number>();
      for (const lead of periodLeads) {
        if (!lead.owner_id) continue;
        const dateStr = getDhakaDateString(new Date(lead.created_at));
        const emp = employeeMap.get(lead.owner_id);
        const buyerTypeLabel = L(
          lead.buyer_type === 'B2B' ? 'পাইকারি (B2B)' : lead.buyer_type === 'DEALER' ? 'ডিলার' : 'খুচরা ক্রেতা'
        );
        historyLogs.push({
          date: dateStr,
          employeeId: lead.owner_id,
          employeeName: emp ? emp.name : 'Unknown',
          value: 1,
          note: `${L('কাস্টমার প্রোফাইল')}: ${lead.name} (${lead.phone})${lead.address ? ` • ${lead.address}` : ''} • ${L('ধরন')}: ${buyerTypeLabel} • ${L('তৈরি করেছেন')}: ${emp ? emp.name : 'Unknown'}`,
        });
        leadsCountByEmp.set(lead.owner_id, (leadsCountByEmp.get(lead.owner_id) || 0) + 1);
      }

      // Check daily entries as well and take whichever is higher or combined
      for (const emp of activeEmployees) {
        let entryTotal = 0;
        for (const e of periodEntries) {
          if (e.employee_id === emp.id && e.metric_type === MetricType.NEW_CLIENTS) {
            entryTotal += Number(e.value);
          }
        }
        const createdCount = leadsCountByEmp.get(emp.id) || 0;
        const total = Math.max(createdCount, entryTotal);
        if (total > 0) {
          empTotals.set(emp.id, total);
        }
      }
    } else {
      // Other metrics: from periodEntries
      for (const e of periodEntries) {
        if (e.metric_type === metricType) {
          const val = Number(e.value);
          if (val > 0) {
            const dateStr = toDhakaDateKey(e.entry_date);
            const emp = employeeMap.get(e.employee_id);
            historyLogs.push({
              date: dateStr,
              employeeId: e.employee_id,
              employeeName: emp ? emp.name : 'Unknown',
              value: val,
              note: e.note || undefined,
            });
            empTotals.set(e.employee_id, (empTotals.get(e.employee_id) || 0) + val);
          }
        }
      }
    }

    // Order logs by date descending and filter by employee if scoped
    const effectiveHistoryLogs = filterEmployeeId
      ? historyLogs.filter((log) => log.employeeId === filterEmployeeId)
      : historyLogs;
    effectiveHistoryLogs.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate employee breakdown
    const employeeBreakdown: EmployeeSectionBreakdown[] = [];
    const overallMetricTarget = Math.round(effectiveTargets[metricType] || 0);

    for (const emp of scopedEmployees) {
      const empTotal = empTotals.get(emp.id) || 0;

      // Check direct targets for this employee
      const directTargets = allTargets.filter(
        (t) => t.employee_id === emp.id && t.metric_type === metricType
      );
      const directEffective = calculateEffectiveTargetsForRange(directTargets, startUtcDate, endUtcDate);
      let empTarget = Math.round(directEffective[metricType] || 0);

      // Fallback to section-based targets
      if (empTarget === 0) {
        const empSectionIds = assignments.filter((a) => a.employee_id === emp.id).map((a) => a.section_id);
        const empSectionTargets = allTargets.filter(
          (t) => (!t.employee_id || t.employee_id === emp.id) && empSectionIds.includes(t.section_id)
        );
        const empEffective = calculateEffectiveTargetsForRange(empSectionTargets, startUtcDate, endUtcDate);
        empTarget = Math.round(empEffective[metricType] || 0);
      }

      // General fallback if system has a shared target
      if (empTarget === 0 && overallMetricTarget > 0 && activeEmployees.length > 0) {
        empTarget = Math.round(overallMetricTarget / activeEmployees.length);
      }

      let bankedSurplus = 0;
      let consumed = empTotal;
      if (secKey === 'NEW_CLIENTS') {
        if (empTarget > 0) {
          consumed = Math.min(empTotal, empTarget);
          bankedSurplus = Math.max(0, empTotal - empTarget);
        } else {
          consumed = 0;
          bankedSurplus = empTotal;
        }
      }

      const hasTarget = empTarget > 0;
      const percentage = empTarget > 0
        ? Math.min(100, Math.round(((secKey === 'NEW_CLIENTS' ? consumed : empTotal) / empTarget) * 100))
        : (empTotal > 0 ? 100 : 0);

      employeeBreakdown.push({
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        total: empTotal,
        target: empTarget,
        percentage,
        hasTarget,
        bankedSurplus: secKey === 'NEW_CLIENTS' ? bankedSurplus : undefined,
        consumed: secKey === 'NEW_CLIENTS' ? consumed : undefined,
      });
    }

    // Sort employee breakdown by total descending
    employeeBreakdown.sort((a, b) => b.total - a.total);

    const totalAchieved = employeeBreakdown.reduce((sum, e) => sum + e.total, 0);
    const sumEmpTargets = employeeBreakdown.reduce((sum, e) => sum + e.target, 0);
    const totalTarget = Math.max(overallMetricTarget, sumEmpTargets);
    const activeEmployeesCount = employeeBreakdown.filter((e) => e.total > 0).length;

    // Average percentage across assigned employees (as requested: "suppose 5 ta employee 5 jon 80 tader target puron korse oi tab er % holo 80 mane sob employee der avarage hobe okhane")
    const assignedEmployees = employeeBreakdown.filter((e) => e.target > 0 || e.total > 0);
    const averagePercentage =
      assignedEmployees.length > 0
        ? Math.round(
            assignedEmployees.reduce((sum, e) => sum + e.percentage, 0) / assignedEmployees.length
          )
        : totalTarget > 0
        ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100))
        : 0;

    result.push({
      key: secKey,
      labelBn: config.labelBn,
      labelEn: config.labelEn,
      unitBn: config.unitBn,
      unitEn: config.unitEn,
      iconName: config.iconName,
      isCurrency: config.isCurrency,
      totalAchieved,
      totalTarget,
      activeEmployeesCount,
      assignedEmployeesCount: assignedEmployees.length,
      averagePercentage,
      employeeBreakdown,
      historyLogs: effectiveHistoryLogs,
    });
  }

  return result;
}

/**
 * Computes groupSectionsOverview for GroupSection models and link completions.
 */
export function computeGroupSectionsOverview(params: {
  allGroupSections: Array<{ id: string; name: string }>;
  allGroupLinks: Array<{ id: string; section_id: string; url: string; title: string | null }>;
  periodLinkCompletions: Array<{
    id: string;
    group_link_id: string;
    employee_id: string;
    completed_at: Date;
  }>;
  activeEmployees: Array<{ id: string; name: string; email: string }>;
  assignments?: Array<{ employee_id: string; section_id: string; post_limit?: number | null }>;
  allTargets?: any[];
  startUtcDate?: Date;
  endUtcDate?: Date;
  filterEmployeeId?: string;
}): GroupSectionOverviewItem[] {
  const {
    allGroupSections,
    allGroupLinks,
    periodLinkCompletions,
    activeEmployees,
    assignments = [],
    allTargets = [],
    startUtcDate,
    endUtcDate,
    filterEmployeeId,
  } = params;

  const scopedEmployees = filterEmployeeId
    ? activeEmployees.filter((e) => e.id === filterEmployeeId)
    : activeEmployees;

  const employeeMap = new Map<string, { id: string; name: string; email: string }>();
  for (const emp of activeEmployees) {
    employeeMap.set(emp.id, emp);
  }

  const linkMap = new Map<string, { id: string; section_id: string; url: string; title: string | null }>();
  for (const l of allGroupLinks) {
    linkMap.set(l.id, l);
  }

  return allGroupSections.map((sec) => {
    const secLinks = allGroupLinks.filter((l) => l.section_id === sec.id);
    const secLinkIdSet = new Set(secLinks.map((l) => l.id));

    // Completions belonging to links in this section
    const secCompletions = periodLinkCompletions.filter(
      (c) => secLinkIdSet.has(c.group_link_id) && (!filterEmployeeId || c.employee_id === filterEmployeeId)
    );

    const empCompletionCount = new Map<string, number>();
    for (const c of secCompletions) {
      empCompletionCount.set(c.employee_id, (empCompletionCount.get(c.employee_id) || 0) + 1);
    }

    const completionsHistory: GroupLinkCompletionHistoryItem[] = secCompletions.map((c) => {
      const link = linkMap.get(c.group_link_id);
      const emp = employeeMap.get(c.employee_id);
      return {
        date: formatDhakaDateTime(c.completed_at),
        employeeName: emp ? emp.name : 'Unknown',
        employeeId: c.employee_id,
        linkUrl: link ? link.url : '',
        linkTitle: link?.title || undefined,
      };
    });

    // Sort completions history by date descending
    completionsHistory.sort((a, b) => b.date.localeCompare(a.date));

    // Build employee breakdown for scoped employees
    const employeeBreakdown: EmployeeSectionBreakdown[] = [];

    for (const emp of scopedEmployees) {
      const empTotal = empCompletionCount.get(emp.id) || 0;

      // Check if employee is assigned to this group section
      const assignment = assignments.find(
        (a) => a.employee_id === emp.id && a.section_id === sec.id
      );

      // Check SectionTarget for this employee & group section
      let empTarget = 0;
      if (startUtcDate && endUtcDate && allTargets.length > 0) {
        const empSecTargets = allTargets.filter(
          (t) =>
            (t.employee_id === emp.id || !t.employee_id) &&
            t.section_id === sec.id
        );
        if (empSecTargets.length > 0) {
          const effective = calculateEffectiveTargetsForRange(empSecTargets, startUtcDate, endUtcDate);
          empTarget = Math.round(effective.POSTS_DONE || 0);
        }
      }

      // If target not set via SectionTarget, fallback to assignment post_limit
      if (empTarget === 0 && assignment && assignment.post_limit && assignment.post_limit > 0) {
        empTarget = assignment.post_limit;
      }

      const isAssigned = Boolean(assignment);
      const hasTarget = isAssigned || empTarget > 0;
      const percentage = empTarget > 0
        ? Math.min(100, Math.round((empTotal / empTarget) * 100))
        : (empTotal > 0 ? 100 : 0);

      employeeBreakdown.push({
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        total: empTotal,
        target: empTarget,
        percentage,
        hasTarget,
      });
    }

    // Sort: assigned employees first, then by total completions desc
    employeeBreakdown.sort((a, b) => {
      if (a.hasTarget !== b.hasTarget) {
        return a.hasTarget ? -1 : 1;
      }
      return b.total - a.total;
    });

    const assignedEmployees = employeeBreakdown.filter(
      (e) => e.hasTarget || e.target > 0 || e.total > 0
    );
    const assignedEmployeesCount = assignedEmployees.length;

    // Average percentage logic:
    // "suppose 5 ta employee 5 jon 80 tader target puron korse oi tab er % holo 80 mane sob employee der avarage hobe okhane"
    const averagePercentage =
      assignedEmployees.length > 0
        ? Math.round(
            assignedEmployees.reduce((sum, e) => sum + e.percentage, 0) / assignedEmployees.length
          )
        : secLinks.length > 0
        ? Math.min(100, Math.round((secCompletions.length / secLinks.length) * 100))
        : 0;

    return {
      id: sec.id,
      name: sec.name,
      totalLinks: secLinks.length,
      completedLinksCount: secCompletions.length,
      assignedEmployeesCount,
      averagePercentage,
      employeeBreakdown,
      completionsHistory,
    };
  });
}

/**
 * Computes employeeWorkSummary for all active employees.
 */
export function computeEmployeeWorkSummary(params: {
  activeEmployees: Array<{ id: string; name: string; email: string }>;
  allTargets: any[];
  effectiveTargets: Record<MetricType, number>;
  assignments: Array<{ employee_id: string; section_id: string }>;
  periodEntries: any[];
  periodLinkCompletions: any[];
  periodDailyTexts: any[];
  startUtcDate: Date;
  endUtcDate: Date;
  filterEmployeeId?: string;
}): EmployeeWorkSummaryItem[] {
  const {
    activeEmployees,
    allTargets,
    effectiveTargets,
    assignments,
    periodEntries,
    periodLinkCompletions,
    periodDailyTexts,
    startUtcDate,
    endUtcDate,
    filterEmployeeId,
  } = params;

  const result: EmployeeWorkSummaryItem[] = [];

  for (const emp of activeEmployees) {
    if (filterEmployeeId && filterEmployeeId !== emp.id) {
      continue;
    }

    const empDailyEntries = periodEntries.filter((e) => e.employee_id === emp.id);
    const empCompletions = periodLinkCompletions.filter((c) => c.employee_id === emp.id);
    const empDailyTexts = periodDailyTexts.filter((t) => t.employee_id === emp.id);

    // Collect all unique dates (YYYY-MM-DD)
    const empDates = new Set<string>();
    for (const e of empDailyEntries) empDates.add(toDhakaDateKey(e.entry_date));
    for (const c of empCompletions) empDates.add(getDhakaDateString(new Date(c.completed_at)));
    for (const t of empDailyTexts) empDates.add(toDhakaDateKey(t.entry_date));

    // Link completions by date
    const empCompsByDate = new Map<string, number>();
    for (const c of empCompletions) {
      const dStr = getDhakaDateString(new Date(c.completed_at));
      empCompsByDate.set(dStr, (empCompsByDate.get(dStr) || 0) + 1);
    }

    // Daily texts by date
    const empTextsByDate = new Map<string, { main_issue?: string | null; next_priorities?: string | null }>();
    for (const t of empDailyTexts) {
      empTextsByDate.set(toDhakaDateKey(t.entry_date), t);
    }

    const history: EmployeeDailyWorkHistoryItem[] = [];

    for (const dateStr of empDates) {
      const dayEntries = empDailyEntries.filter((e) => toDhakaDateKey(e.entry_date) === dateStr);
      const dayCompCount = empCompsByDate.get(dateStr) || 0;
      const dayText = empTextsByDate.get(dateStr);

      const getVal = (type: MetricType) => {
        const entry = dayEntries.find((e) => e.metric_type === type);
        return entry ? Number(entry.value) : 0;
      };

      const dayPostVal = getVal(MetricType.POSTS_DONE);
      const posts_done = Math.max(dayCompCount, dayPostVal);
      const orders_confirmed = getVal(MetricType.CONFIRMED_ORDERS);
      const messages_replied = getVal(MetricType.FOLLOWUPS_DONE);
      const leads_collected = getVal(MetricType.NEW_LEADS);
      const sales_amount = getVal(MetricType.SALES_AMOUNT);

      // Notes on this date
      const entryNotes = dayEntries
        .map((e) => e.note)
        .filter((n): n is string => !!n && n.trim().length > 0);
      const noteParts: string[] = [];
      if (dayText?.main_issue) noteParts.push(dayText.main_issue);
      if (dayText?.next_priorities) noteParts.push(dayText.next_priorities);
      noteParts.push(...entryNotes);

      const note = noteParts.length > 0 ? noteParts.join(' | ') : undefined;

      if (posts_done > 0 || orders_confirmed > 0 || messages_replied > 0 || leads_collected > 0 || sales_amount > 0 || note) {
        history.push({
          date: dateStr,
          posts_done,
          orders_confirmed,
          messages_replied,
          leads_collected,
          sales_amount,
          note,
        });
      }
    }

    // Sort history by date descending
    history.sort((a, b) => b.date.localeCompare(a.date));

    // Sum overall metrics for the period
    const metrics: EmployeeWorkMetrics = {
      posts_done: history.reduce((sum, h) => sum + h.posts_done, 0),
      orders_confirmed: history.reduce((sum, h) => sum + h.orders_confirmed, 0),
      messages_replied: history.reduce((sum, h) => sum + h.messages_replied, 0),
      leads_collected: history.reduce((sum, h) => sum + h.leads_collected, 0),
      sales_amount: history.reduce((sum, h) => sum + h.sales_amount, 0),
    };

    // Calculate target progress percentage
    const empSectionIds = assignments.filter((a) => a.employee_id === emp.id).map((a) => a.section_id);
    const empTargets = allTargets.filter((t) => empSectionIds.includes(t.section_id));
    const empEffective = calculateEffectiveTargetsForRange(empTargets, startUtcDate, endUtcDate);

    const targetsToCheck = [
      { target: empEffective.POSTS_DONE, achieved: metrics.posts_done },
      { target: empEffective.CONFIRMED_ORDERS, achieved: metrics.orders_confirmed },
      { target: empEffective.FOLLOWUPS_DONE, achieved: metrics.messages_replied },
      { target: empEffective.NEW_LEADS, achieved: metrics.leads_collected },
      { target: empEffective.SALES_AMOUNT, achieved: metrics.sales_amount },
    ];

    let targetProgressPercent = 0;
    const validTargets = targetsToCheck.filter((t) => t.target && t.target > 0);
    if (validTargets.length > 0) {
      const totalPct = validTargets.reduce((sum, item) => {
        const pct = Math.min(100, Math.round((item.achieved / (item.target || 1)) * 100));
        return sum + pct;
      }, 0);
      targetProgressPercent = Math.round(totalPct / validTargets.length);
    } else {
      const numEmps = Math.max(1, activeEmployees.length);
      const overallTargetsToCheck = [
        { target: (effectiveTargets.POSTS_DONE || 0) / numEmps, achieved: metrics.posts_done },
        { target: (effectiveTargets.CONFIRMED_ORDERS || 0) / numEmps, achieved: metrics.orders_confirmed },
        { target: (effectiveTargets.FOLLOWUPS_DONE || 0) / numEmps, achieved: metrics.messages_replied },
        { target: (effectiveTargets.NEW_LEADS || 0) / numEmps, achieved: metrics.leads_collected },
        { target: (effectiveTargets.SALES_AMOUNT || 0) / numEmps, achieved: metrics.sales_amount },
      ];
      const validOverall = overallTargetsToCheck.filter((t) => t.target > 0);
      if (validOverall.length > 0) {
        const totalPct = validOverall.reduce((sum, item) => {
          const pct = Math.min(100, Math.round((item.achieved / item.target) * 100));
          return sum + pct;
        }, 0);
        targetProgressPercent = Math.round(totalPct / validOverall.length);
      } else {
        const hasWork = metrics.posts_done > 0 || metrics.orders_confirmed > 0 || metrics.messages_replied > 0 || metrics.leads_collected > 0 || metrics.sales_amount > 0;
        targetProgressPercent = hasWork ? 100 : 0;
      }
    }

    result.push({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      metrics,
      targetProgressPercent,
      history,
    });
  }

  // Sort employees: highest sales / orders / posts first
  result.sort(
    (a, b) =>
      b.metrics.sales_amount - a.metrics.sales_amount ||
      b.metrics.orders_confirmed - a.metrics.orders_confirmed ||
      b.metrics.posts_done - a.metrics.posts_done
  );

  return result;
}
