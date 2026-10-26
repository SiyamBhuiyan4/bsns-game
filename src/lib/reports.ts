import prisma from './prisma';
import { calculateEffectiveTargetsForRange } from './targets';
import { calculateEmployeeScore } from './scoring';
import { MetricType } from '@prisma/client';
import { format } from 'date-fns';

export interface WeeklyAutoData {
  summary: {
    total_sales: number;
    total_profit: number;
    total_posts: number;
    total_new_clients: number;
    total_b2b_orders: number;
    total_retention: number;
    total_followups: number;
    team_avg_score: number;
  };
  top_products: {
    product_id: string;
    product_name_bn: string;
    product_name_en: string;
    unit: string;
    total_quantity: number;
    total_amount: number;
  }[];
  campaign_performance: {
    campaign_id: string;
    campaign_name: string;
    channel: string;
    budget: number;
    leads_count: number;
    orders_count: number;
    orders_amount: number;
    conversion_rate: number;
  }[];
  channel_breakdown: {
    channel: string;
    channel_bn: string;
    leads_count: number;
    orders_count: number;
    total_amount: number;
  }[];
}

export const CHANNEL_BN_MAP: Record<string, string> = {
  FACEBOOK_GROUP: 'ফেসবুক গ্রুপ (Organic)',
  FACEBOOK_AD: 'ফেসবুক বিজ্ঞাপন (Paid)',
  GOOGLE_AD: 'গুগল বিজ্ঞাপন',
  YOUTUBE: 'ইউটিউব',
  DIRECT: 'সরাসরি / অন্যান্য',
  OTHER: 'অন্যান্য চ্যানেল',
};

export const WEEKLY_FIXED_QUESTIONS = [
  { no: 1, text: 'কোন পণ্য সবচেয়ে বেশি বিক্রি হয়েছে?' },
  { no: 2, text: 'কোন বিজ্ঞাপন থেকে সবচেয়ে ভালো মানের ক্রেতা এসেছে?' },
  { no: 3, text: 'কোন সম্ভাব্য ক্রেতার অর্ডার এখনো সম্পন্ন হয়নি?' },
  { no: 4, text: 'কোন পণ্যের স্টক, মূল্য, সরবরাহ বা গ্রাহকসেবার সমস্যা বিক্রিতে বাধা দিচ্ছে?' },
  { no: 5, text: 'পরবর্তী সপ্তাহে কোন তিনটি কাজ বিক্রি ও লাভ বৃদ্ধিতে সবচেয়ে বেশি সাহায্য করবে?' },
];

export interface MonthlyAutoData {
  month: string;
  mom_growth: {
    current: {
      sales: number;
      profit: number;
      posts: number;
    };
    previous: {
      sales: number;
      profit: number;
      posts: number;
    };
    diff: {
      sales: number;
      profit: number;
      posts: number;
    };
    growth_pct: {
      sales: number;
      profit: number;
      posts: number;
    };
  };
  employee_rankings: {
    employee_id: string;
    employee_name: string;
    email: string;
    posts_done: number;
    sales_amount: number;
    profit_amount: number;
    score: number;
    rank: number;
    is_top_performer: boolean;
  }[];
  budget_summary: {
    monthly_budget: number;
    actual_spend: number;
    percentage_used: number;
    remaining: number;
  };
  section_achievements: {
    section_id: string;
    section_name: string;
    posts_target: number;
    posts_actual: number;
    posts_pct: number;
    sales_target: number;
    sales_actual: number;
    sales_pct: number;
  }[];
  top_products: {
    product_id: string;
    product_name_bn: string;
    product_name_en: string;
    unit: string;
    quantity: number;
    revenue: number;
    revenue_share_pct: number;
  }[];
  channel_breakdown: {
    channel: string;
    channel_bn: string;
    leads_count: number;
    orders_count: number;
    total_amount: number;
    conversion_rate: number;
  }[];
}

/**
 * Calculates month boundaries for current and previous month in Asia/Dhaka.
 */
export function getMonthDateRange(monthStr: string) {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10);

  const startDateStr = `${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const startUtc = new Date(`${startDateStr}T00:00:00+06:00`);
  const endUtc = new Date(`${endDateStr}T23:59:59.999+06:00`);

  let prevYear = year;
  let prevMonthNum = month - 1;
  if (prevMonthNum === 0) {
    prevMonthNum = 12;
    prevYear -= 1;
  }
  const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
  const prevStartDateStr = `${prevMonthStr}-01`;
  const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
  const prevEndDateStr = `${prevMonthStr}-${String(prevLastDay).padStart(2, '0')}`;
  const prevStartUtc = new Date(`${prevStartDateStr}T00:00:00+06:00`);
  const prevEndUtc = new Date(`${prevEndDateStr}T23:59:59.999+06:00`);

  return {
    monthStr,
    startDate: new Date(`${startDateStr}T00:00:00.000Z`),
    endDate: new Date(`${endDateStr}T23:59:59.999Z`),
    startUtc,
    endUtc,
    prevMonthStr,
    prevStartDate: new Date(`${prevStartDateStr}T00:00:00.000Z`),
    prevEndDate: new Date(`${prevEndDateStr}T23:59:59.999Z`),
    prevStartUtc,
    prevEndUtc,
  };
}

/**
 * Calculates growth percentage from previous to current.
 */
export function calculateGrowthPct(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Computes automated analytics for a given week interval.
 */
export async function computeWeeklyAutoData(
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyAutoData> {
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');
  const startUtc = new Date(`${startStr}T00:00:00+06:00`);
  const endUtc = new Date(`${endStr}T23:59:59.999+06:00`);

  // 1. Team aggregate metrics from DailyEntry & LinkCompletion
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', is_active: true },
    include: {
      assignments_as_employee: true,
    },
  });

  const allTargets = await prisma.sectionTarget.findMany();
  const scoringSettings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
  const cap = scoringSettings ? Number(scoringSettings.achievement_cap) : 1.0;
  const failingThreshold = scoringSettings ? Number(scoringSettings.failing_threshold) : 0.8;

  let totalSales = 0;
  let totalProfit = 0;
  let totalPosts = 0;
  let totalNewClients = 0;
  let totalB2b = 0;
  let totalRetention = 0;
  let totalFollowups = 0;
  let totalScoreSum = 0;

  for (const emp of employees) {
    const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
    const empTargets = allTargets.filter((t) => assignedSectionIds.includes(t.section_id));
    const effectiveTargets = calculateEffectiveTargetsForRange(empTargets, weekStart, weekEnd);

    const postsCount = await prisma.linkCompletion.count({
      where: {
        employee_id: emp.id,
        completed_at: { gte: startUtc, lte: endUtc },
        undone_at: null,
      },
    });

    const entries = await prisma.dailyEntry.findMany({
      where: {
        employee_id: emp.id,
        entry_date: { gte: weekStart, lte: weekEnd },
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
        metricMap[e.metric_type] = (metricMap[e.metric_type] || 0) + Number(e.value);
      }
    }

    const scoringInput = {
      [MetricType.POSTS_DONE]: { target: effectiveTargets.POSTS_DONE || null, achieved: metricMap.POSTS_DONE },
      [MetricType.SALES_AMOUNT]: { target: effectiveTargets.SALES_AMOUNT || null, achieved: metricMap.SALES_AMOUNT },
      [MetricType.PROFIT_AMOUNT]: { target: effectiveTargets.PROFIT_AMOUNT || null, achieved: metricMap.PROFIT_AMOUNT },
      [MetricType.NEW_CLIENTS]: { target: effectiveTargets.NEW_CLIENTS || null, achieved: metricMap.NEW_CLIENTS },
      [MetricType.B2B_ORDERS]: { target: effectiveTargets.B2B_ORDERS || null, achieved: metricMap.B2B_ORDERS },
      [MetricType.RETENTION_COUNT]: { target: effectiveTargets.RETENTION_COUNT || null, achieved: metricMap.RETENTION_COUNT },
      [MetricType.FOLLOWUPS_DONE]: { target: effectiveTargets.FOLLOWUPS_DONE || null, achieved: metricMap.FOLLOWUPS_DONE },
    };

    const scoreResult = calculateEmployeeScore(scoringInput, {
      achievementCap: cap,
      failingThreshold,
    });

    totalSales += metricMap.SALES_AMOUNT;
    totalProfit += metricMap.PROFIT_AMOUNT;
    totalPosts += metricMap.POSTS_DONE;
    totalNewClients += metricMap.NEW_CLIENTS;
    totalB2b += metricMap.B2B_ORDERS;
    totalRetention += metricMap.RETENTION_COUNT;
    totalFollowups += metricMap.FOLLOWUPS_DONE;
    totalScoreSum += scoreResult.totalScore;
  }

  const teamAvgScore = employees.length > 0 ? Number((totalScoreSum / employees.length).toFixed(2)) : 0;

  // 2. Question 1: Top Selling Products
  const productSales = await prisma.dailyProductSale.findMany({
    where: {
      entry_date: { gte: weekStart, lte: weekEnd },
    },
    include: { product: true },
  });

  const productMap = new Map<string, {
    product_id: string;
    product_name_bn: string;
    product_name_en: string;
    unit: string;
    total_quantity: number;
    total_amount: number;
  }>();

  for (const ps of productSales) {
    const existing = productMap.get(ps.product_id) || {
      product_id: ps.product_id,
      product_name_bn: ps.product.name_bn,
      product_name_en: ps.product.name_en,
      unit: ps.product.unit,
      total_quantity: 0,
      total_amount: 0,
    };
    existing.total_quantity += Number(ps.quantity);
    existing.total_amount += Number(ps.amount);
    productMap.set(ps.product_id, existing);
  }

  const topProducts = Array.from(productMap.values()).sort(
    (a, b) => b.total_amount - a.total_amount
  );

  // 3. Question 2: Campaign Performance
  const campaigns = await prisma.campaign.findMany({
    include: {
      leads: {
        where: {
          created_at: { gte: startUtc, lte: endUtc },
        },
      },
    },
  });

  const campaignPerformance = campaigns.map((c) => {
    const leadsCount = c.leads.length;
    const orders = c.leads.filter((l: any) => l.status === 'ORDERED');
    const ordersCount = orders.length;
    const ordersAmount = orders.reduce((sum: any, l: any) => sum + (Number(l.order_amount) || 0), 0);
    const conversionRate = leadsCount > 0 ? Number(((ordersCount / leadsCount) * 100).toFixed(1)) : 0;

    return {
      campaign_id: c.id,
      campaign_name: c.name,
      channel: c.channel,
      budget: Number(c.budget_amount),
      leads_count: leadsCount,
      orders_count: ordersCount,
      orders_amount: ordersAmount,
      conversion_rate: conversionRate,
    };
  }).sort((a, b) => b.orders_amount - a.orders_amount);

  // 4. Question 3: Channel Breakdown
  const weekLeads = await prisma.lead.findMany({
    where: {
      created_at: { gte: startUtc, lte: endUtc },
    },
  });

  const channelMap = new Map<string, {
    channel: string;
    channel_bn: string;
    leads_count: number;
    orders_count: number;
    total_amount: number;
  }>();

  // Initialize channels
  const standardChannels = ['FACEBOOK_GROUP', 'FACEBOOK_AD', 'GOOGLE_AD', 'YOUTUBE', 'OTHER'];
  for (const ch of standardChannels) {
    channelMap.set(ch, {
      channel: ch,
      channel_bn: CHANNEL_BN_MAP[ch] || ch,
      leads_count: 0,
      orders_count: 0,
      total_amount: 0,
    });
  }

  for (const l of weekLeads) {
    const ch = l.source_channel || 'OTHER';
    const existing = channelMap.get(ch) || {
      channel: ch,
      channel_bn: CHANNEL_BN_MAP[ch] || ch,
      leads_count: 0,
      orders_count: 0,
      total_amount: 0,
    };
    existing.leads_count++;
    if (l.status === 'ORDERED') {
      existing.orders_count++;
      existing.total_amount += Number(l.order_amount) || 0;
    }
    channelMap.set(ch, existing);
  }

  const channelBreakdown = Array.from(channelMap.values());

  return {
    summary: {
      total_sales: totalSales,
      total_profit: totalProfit,
      total_posts: totalPosts,
      total_new_clients: totalNewClients,
      total_b2b_orders: totalB2b,
      total_retention: totalRetention,
      total_followups: totalFollowups,
      team_avg_score: teamAvgScore,
    },
    top_products: topProducts,
    campaign_performance: campaignPerformance,
    channel_breakdown: channelBreakdown,
  };
}

/**
 * Computes automated analytics for a whole month (Section 1-6).
 */
export async function computeMonthlyAutoData(monthStr: string): Promise<MonthlyAutoData> {
  const range = getMonthDateRange(monthStr);

  const scoringSettings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
  const cap = scoringSettings ? Number(scoringSettings.achievement_cap) : 1.0;
  const failingThreshold = scoringSettings ? Number(scoringSettings.failing_threshold) : 0.8;

  // 1. SECTION 1: Month-over-Month Growth
  // Posts
  const currentPosts = await prisma.linkCompletion.count({
    where: {
      completed_at: { gte: range.startUtc, lte: range.endUtc },
      undone_at: null,
    },
  });
  const prevPosts = await prisma.linkCompletion.count({
    where: {
      completed_at: { gte: range.prevStartUtc, lte: range.prevEndUtc },
      undone_at: null,
    },
  });

  // Daily entries current
  const currentEntries = await prisma.dailyEntry.findMany({
    where: {
      entry_date: { gte: range.startDate, lte: range.endDate },
    },
  });
  let currentSales = 0;
  let currentProfit = 0;
  let currentAdSpend = 0;
  for (const e of currentEntries) {
    if (e.metric_type === MetricType.SALES_AMOUNT) currentSales += Number(e.value);
    if (e.metric_type === MetricType.PROFIT_AMOUNT) currentProfit += Number(e.value);
    if (e.metric_type === MetricType.AD_SPEND) currentAdSpend += Number(e.value);
  }

  // Daily entries previous
  const prevEntries = await prisma.dailyEntry.findMany({
    where: {
      entry_date: { gte: range.prevStartDate, lte: range.prevEndDate },
    },
  });
  let prevSales = 0;
  let prevProfit = 0;
  for (const e of prevEntries) {
    if (e.metric_type === MetricType.SALES_AMOUNT) prevSales += Number(e.value);
    if (e.metric_type === MetricType.PROFIT_AMOUNT) prevProfit += Number(e.value);
  }

  const momGrowth = {
    current: {
      sales: currentSales,
      profit: currentProfit,
      posts: currentPosts,
    },
    previous: {
      sales: prevSales,
      profit: prevProfit,
      posts: prevPosts,
    },
    diff: {
      sales: currentSales - prevSales,
      profit: currentProfit - prevProfit,
      posts: currentPosts - prevPosts,
    },
    growth_pct: {
      sales: calculateGrowthPct(currentSales, prevSales),
      profit: calculateGrowthPct(currentProfit, prevProfit),
      posts: calculateGrowthPct(currentPosts, prevPosts),
    },
  };

  // 2. SECTION 2: Employee Performance Ranking
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', is_active: true },
    include: {
      assignments_as_employee: true,
    },
  });

  const allTargets = await prisma.sectionTarget.findMany();
  const employeeRankings: MonthlyAutoData['employee_rankings'] = [];
  const employeeSalesMap = new Map<string, number>();
  const employeeSectionCountMap = new Map<string, number>();

  for (const emp of employees) {
    const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
    employeeSectionCountMap.set(emp.id, Math.max(1, assignedSectionIds.length));

    const empTargets = allTargets.filter((t) => assignedSectionIds.includes(t.section_id));
    const effectiveTargets = calculateEffectiveTargetsForRange(empTargets, range.startDate, range.endDate);

    const empPosts = await prisma.linkCompletion.count({
      where: {
        employee_id: emp.id,
        completed_at: { gte: range.startUtc, lte: range.endUtc },
        undone_at: null,
      },
    });

    const empEntries = currentEntries.filter((e) => e.employee_id === emp.id);
    const metricMap: Record<string, number> = {
      POSTS_DONE: empPosts,
      SALES_AMOUNT: 0,
      PROFIT_AMOUNT: 0,
      NEW_CLIENTS: 0,
      B2B_ORDERS: 0,
      RETENTION_COUNT: 0,
      FOLLOWUPS_DONE: 0,
    };
    for (const e of empEntries) {
      metricMap[e.metric_type] = (metricMap[e.metric_type] || 0) + Number(e.value);
    }
    employeeSalesMap.set(emp.id, metricMap.SALES_AMOUNT);

    const scoringInput = {
      [MetricType.POSTS_DONE]: { target: effectiveTargets.POSTS_DONE || null, achieved: metricMap.POSTS_DONE },
      [MetricType.SALES_AMOUNT]: { target: effectiveTargets.SALES_AMOUNT || null, achieved: metricMap.SALES_AMOUNT },
      [MetricType.PROFIT_AMOUNT]: { target: effectiveTargets.PROFIT_AMOUNT || null, achieved: metricMap.PROFIT_AMOUNT },
      [MetricType.NEW_CLIENTS]: { target: effectiveTargets.NEW_CLIENTS || null, achieved: metricMap.NEW_CLIENTS },
      [MetricType.B2B_ORDERS]: { target: effectiveTargets.B2B_ORDERS || null, achieved: metricMap.B2B_ORDERS },
      [MetricType.RETENTION_COUNT]: { target: effectiveTargets.RETENTION_COUNT || null, achieved: metricMap.RETENTION_COUNT },
      [MetricType.FOLLOWUPS_DONE]: { target: effectiveTargets.FOLLOWUPS_DONE || null, achieved: metricMap.FOLLOWUPS_DONE },
    };

    const scoreResult = calculateEmployeeScore(scoringInput, {
      achievementCap: cap,
      failingThreshold,
    });

    employeeRankings.push({
      employee_id: emp.id,
      employee_name: emp.name,
      email: emp.email,
      posts_done: empPosts,
      sales_amount: metricMap.SALES_AMOUNT,
      profit_amount: metricMap.PROFIT_AMOUNT,
      score: scoreResult.totalScore,
      rank: 0,
      is_top_performer: false,
    });
  }

  // Sort descending by score, tie-break by sales
  employeeRankings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.sales_amount - a.sales_amount;
  });

  employeeRankings.forEach((emp, index) => {
    emp.rank = index + 1;
    emp.is_top_performer = index === 0 && emp.score > 0;
  });

  // 3. SECTION 3: Budget vs Actual Spend
  const monthlyBudgetRecord = await prisma.budgetLimit.findFirst({
    where: {
      scope: 'MONTHLY_TOTAL',
      month: monthStr,
    },
  });
  const monthlyBudget = Number(monthlyBudgetRecord?.amount || 0);

  // If daily entries have ad spend, use that; else sum active campaign budgets
  let actualSpend = currentAdSpend;
  if (actualSpend === 0) {
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        start_date: { lte: range.endUtc },
        OR: [
          { end_date: null },
          { end_date: { gte: range.startUtc } },
        ],
      },
    });
    actualSpend = activeCampaigns.reduce((acc, c) => acc + Number(c.budget_amount || 0), 0);
  }

  const budgetSummary = {
    monthly_budget: monthlyBudget,
    actual_spend: actualSpend,
    percentage_used: monthlyBudget > 0 ? Number(((actualSpend / monthlyBudget) * 100).toFixed(1)) : 0,
    remaining: monthlyBudget - actualSpend,
  };

  // 4. SECTION 4: Section Targets vs Actuals
  const sections = await prisma.groupSection.findMany({
    where: { is_active: true },
    include: { assignments: true },
  });

  const sectionAchievements: MonthlyAutoData['section_achievements'] = [];
  for (const s of sections) {
    const sTargets = allTargets.filter((t) => t.section_id === s.id);
    const effTargets = calculateEffectiveTargetsForRange(sTargets, range.startDate, range.endDate);

    const postsTarget = Math.round(effTargets.POSTS_DONE || 0);
    const salesTarget = Math.round(effTargets.SALES_AMOUNT || 0);

    const postsActual = await prisma.linkCompletion.count({
      where: {
        group_link: { section_id: s.id },
        completed_at: { gte: range.startUtc, lte: range.endUtc },
        undone_at: null,
      },
    });

    let salesActual = 0;
    for (const a of s.assignments) {
      const empSales = employeeSalesMap.get(a.employee_id) || 0;
      const numSections = employeeSectionCountMap.get(a.employee_id) || 1;
      salesActual += Math.round(empSales / numSections);
    }

    sectionAchievements.push({
      section_id: s.id,
      section_name: s.name,
      posts_target: postsTarget,
      posts_actual: postsActual,
      posts_pct: postsTarget > 0 ? Number(((postsActual / postsTarget) * 100).toFixed(1)) : 0,
      sales_target: salesTarget,
      sales_actual: salesActual,
      sales_pct: salesTarget > 0 ? Number(((salesActual / salesTarget) * 100).toFixed(1)) : 0,
    });
  }

  // 5. SECTION 5: Top Products of the Month
  const productSales = await prisma.dailyProductSale.findMany({
    where: {
      entry_date: { gte: range.startDate, lte: range.endDate },
    },
    include: { product: true },
  });

  const productMap = new Map<string, {
    product_id: string;
    product_name_bn: string;
    product_name_en: string;
    unit: string;
    quantity: number;
    revenue: number;
  }>();

  let totalProductRevenue = 0;
  for (const ps of productSales) {
    const existing = productMap.get(ps.product_id) || {
      product_id: ps.product_id,
      product_name_bn: ps.product.name_bn,
      product_name_en: ps.product.name_en,
      unit: ps.product.unit,
      quantity: 0,
      revenue: 0,
    };
    const qty = Number(ps.quantity);
    const amt = Number(ps.amount);
    existing.quantity += qty;
    existing.revenue += amt;
    totalProductRevenue += amt;
    productMap.set(ps.product_id, existing);
  }

  const topProducts = Array.from(productMap.values())
    .map((p) => ({
      ...p,
      revenue_share_pct: totalProductRevenue > 0 ? Number(((p.revenue / totalProductRevenue) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 6. SECTION 6: Channel Breakdown
  const monthLeads = await prisma.lead.findMany({
    where: {
      created_at: { gte: range.startUtc, lte: range.endUtc },
    },
  });

  const channelMap = new Map<string, {
    channel: string;
    channel_bn: string;
    leads_count: number;
    orders_count: number;
    total_amount: number;
  }>();

  const standardChannels = ['FACEBOOK_GROUP', 'FACEBOOK_AD', 'GOOGLE_AD', 'YOUTUBE', 'OTHER'];
  for (const ch of standardChannels) {
    channelMap.set(ch, {
      channel: ch,
      channel_bn: CHANNEL_BN_MAP[ch] || ch,
      leads_count: 0,
      orders_count: 0,
      total_amount: 0,
    });
  }

  for (const l of monthLeads) {
    const ch = l.source_channel || 'OTHER';
    const existing = channelMap.get(ch) || {
      channel: ch,
      channel_bn: CHANNEL_BN_MAP[ch] || ch,
      leads_count: 0,
      orders_count: 0,
      total_amount: 0,
    };
    existing.leads_count++;
    if (l.status === 'ORDERED') {
      existing.orders_count++;
      existing.total_amount += Number(l.order_amount) || 0;
    }
    channelMap.set(ch, existing);
  }

  const channelBreakdown = Array.from(channelMap.values()).map((c) => ({
    ...c,
    conversion_rate: c.leads_count > 0 ? Number(((c.orders_count / c.leads_count) * 100).toFixed(1)) : 0,
  }));

  return {
    month: monthStr,
    mom_growth: momGrowth,
    employee_rankings: employeeRankings,
    budget_summary: budgetSummary,
    section_achievements: sectionAchievements,
    top_products: topProducts,
    channel_breakdown: channelBreakdown,
  };
}

export interface DailyReportSummary {
  date: string;
  total_sales: number;
  total_profit: number;
  total_posts: number;
  new_leads: number;
  confirmed_orders: number;
  active_employees_count: number;
  team_avg_score: number;
  passing_count: number;
  failing_count: number;
}

/**
 * Calculates high-level summary metrics for a given date in Asia/Dhaka (+06:00).
 */
export async function getDailyReportSummary(dateStr: string): Promise<DailyReportSummary> {
  const dayStartUtc = new Date(`${dateStr}T00:00:00+06:00`);
  const dayEndUtc = new Date(`${dateStr}T23:59:59.999+06:00`);
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

  const entries = await prisma.dailyEntry.findMany({
    where: { entry_date: targetDate },
  });

  let total_sales = 0;
  let total_profit = 0;
  const activeEmployeeIds = new Set<string>();

  for (const e of entries) {
    activeEmployeeIds.add(e.employee_id);
    if (e.metric_type === MetricType.SALES_AMOUNT) total_sales += Number(e.value);
    if (e.metric_type === MetricType.PROFIT_AMOUNT) total_profit += Number(e.value);
  }

  const total_posts = await prisma.linkCompletion.count({
    where: {
      completed_at: { gte: dayStartUtc, lte: dayEndUtc },
      undone_at: null,
    },
  });

  const new_leads = await prisma.lead.count({
    where: {
      created_at: { gte: dayStartUtc, lte: dayEndUtc },
    },
  });

  const confirmed_orders = await prisma.lead.count({
    where: {
      status: 'ORDERED',
      updated_at: { gte: dayStartUtc, lte: dayEndUtc },
    },
  });

  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', is_active: true },
    include: { assignments_as_employee: true },
  });

  const allTargets = await prisma.sectionTarget.findMany();
  const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
  const cap = settings ? Number(settings.achievement_cap) : 1.0;
  const failingThreshold = settings ? Number(settings.failing_threshold) : 0.8;

  let totalScoreSum = 0;
  let passing_count = 0;
  let failing_count = 0;

  for (const emp of employees) {
    const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
    const empTargets = allTargets.filter((t) => assignedSectionIds.includes(t.section_id));
    const dailyTargets = calculateEffectiveTargetsForRange(empTargets, targetDate, targetDate);

    const empEntries = entries.filter((e) => e.employee_id === emp.id);
    const metricMap: Record<string, number> = {
      POSTS_DONE: 0,
      SALES_AMOUNT: 0,
      PROFIT_AMOUNT: 0,
      NEW_CLIENTS: 0,
      B2B_ORDERS: 0,
      RETENTION_COUNT: 0,
      FOLLOWUPS_DONE: 0,
    };
    for (const e of empEntries) {
      if (e.metric_type !== MetricType.POSTS_DONE) {
        metricMap[e.metric_type] = Number(e.value);
      }
    }

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
    });

    totalScoreSum += scoreResult.totalScore;
    if (scoreResult.isFailing) failing_count++;
    else passing_count++;
  }

  const team_avg_score = employees.length > 0 ? Number((totalScoreSum / employees.length).toFixed(2)) : 0;

  return {
    date: dateStr,
    total_sales,
    total_profit,
    total_posts,
    new_leads,
    confirmed_orders,
    active_employees_count: activeEmployeeIds.size,
    team_avg_score,
    passing_count,
    failing_count,
  };
}
