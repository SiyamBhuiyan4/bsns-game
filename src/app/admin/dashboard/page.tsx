import { requireAdmin } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import DashboardPeriodSelector from '@/components/dashboard/DashboardPeriodSelector';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import SetupChecklist from '@/components/admin/SetupChecklist';
import {
  Users,
  Layers,
  CheckCircle2,
  Trophy,
  AlertTriangle,
  Wallet,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  UserCheck,
  AlertOctagon,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { toBengaliDigits, formatTaka } from '@/lib/date';

interface PageProps {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminDashboardPage(props: PageProps) {
  const admin = await requireAdmin();

  // Next.js 15 searchParams resolution
  const searchParams = props.searchParams ? await props.searchParams : {};
  const rawPeriod = searchParams.period;
  const period = (rawPeriod as DashboardPeriodKey) || 'thisMonth';
  const from = searchParams.from;
  const to = searchParams.to;

  const dashboardData = await getAdminDashboardData({ period, from, to });
  const { periodInfo, summaryCards, alerts, planWidget, charts } = dashboardData;

  // Determine budget progress bar styling
  const budgetPct = summaryCards.budgetUsed.percentage;
  let budgetBarColor = 'bg-emerald-500';
  let budgetTextColor = 'text-emerald-700';

  if (summaryCards.budgetUsed.statusColor === 'red') {
    budgetBarColor = 'bg-rose-500';
    budgetTextColor = 'text-rose-700';
  } else if (summaryCards.budgetUsed.statusColor === 'yellow') {
    budgetBarColor = 'bg-amber-500';
    budgetTextColor = 'text-amber-700';
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Step-by-step guide for new admins */}
      <SetupChecklist />

      {/* Welcome & Timezone Header Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              হেড অব মার্কেটিং ড্যাশবোর্ড (Head of Marketing Control Center)
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              স্বাগতম, {admin.name}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              ডিজিটাল মার্কেটিং পারফরম্যান্স, বাজেট ও বিক্রয় মনিটরিং কনসোল
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              <span>ঢাকা: {toBengaliDigits(periodInfo.todayStr)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 90-DAY PLAN WIDGET (Section 9) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CalendarCheck className="h-3.5 w-3.5" />
                ৯০ দিনের কর্মপরিকল্পনা উইজেট
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                <Clock className="h-3.5 w-3.5" />
                দিন {toBengaliDigits(planWidget.currentDay)} / ৯০ ({planWidget.currentPhaseName})
              </span>
              {planWidget.overdueTasksCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  {toBengaliDigits(planWidget.overdueTasksCount)}টি টাস্ক বিলম্বিত (Overdue)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  কোনো বিলম্বিত টাস্ক নেই
                </span>
              )}
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {planWidget.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                বর্তমান পর্যায়: <strong className="text-slate-800">{planWidget.currentPhaseName}</strong> | মোট টাস্ক: {toBengaliDigits(planWidget.totalTasksCount)}টি (সম্পন্ন: {toBengaliDigits(planWidget.completedTasksCount)}টি)
              </p>
            </div>
          </div>

          <div className="w-full lg:w-80 flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  সার্বিক অগ্রগতি
                </span>
                <span className="text-emerald-700 text-sm font-extrabold">{toBengaliDigits(planWidget.overallProgress)}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, planWidget.overallProgress))}%` }}
                />
              </div>
            </div>

            <Link
              href="/admin/plan"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <span>৯০ দিনের প্ল্যান বিস্তারিত ও ব্যবস্থাপনা</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Period Selector Component */}
      <DashboardPeriodSelector
        currentPeriod={periodInfo.period}
        currentFrom={from}
        currentTo={to}
      />

      {/* SUMMARY CARDS (6 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Active Employees */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সক্রিয় কর্মী</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {toBengaliDigits(summaryCards.activeEmployeesCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">ডিজিটাল মার্কেটিং টিম</p>
          </div>
        </div>

        {/* Card 2: Active Sections */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সক্রিয় সেকশন</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {toBengaliDigits(summaryCards.activeSectionsCount)} <span className="text-sm font-normal text-slate-500">টি</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">কাজের গ্রুপ বিভাজন</p>
          </div>
        </div>

        {/* Card 3: Links Completed in Period */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সম্পন্ন লিংক</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">
              {toBengaliDigits(summaryCards.linksCompletedCount)} <span className="text-sm font-normal text-slate-500">টি</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate" title={periodInfo.label}>
              {periodInfo.label}
            </p>
          </div>
        </div>

        {/* Card 4: Top Performer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">শীর্ষ পারফর্মার</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold text-slate-900 truncate" title={summaryCards.topPerformer?.name || 'তথ্য নেই'}>
              {summaryCards.topPerformer ? summaryCards.topPerformer.name : 'তথ্য নেই'}
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 font-semibold">
              {summaryCards.topPerformer
                ? `স্কোর: ${toBengaliDigits(summaryCards.topPerformer.score)}%`
                : 'এই সময়ে ডাটা নেই'}
            </p>
          </div>
        </div>

        {/* Card 5: Employees Below 80% */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ফেইলিং কর্মী</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${summaryCards.failingEmployeesCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
              <AlertOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black ${summaryCards.failingEmployeesCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {toBengaliDigits(summaryCards.failingEmployeesCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">স্কোর ৮০%-এর নিচে</p>
          </div>
        </div>

        {/* Card 6: Monthly Budget Used */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মাসের বাজেট খরচ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black ${budgetTextColor}`}>
              {toBengaliDigits(budgetPct)}%
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${budgetBarColor} transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, budgetPct))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-500 truncate" title={`${formatTaka(summaryCards.budgetUsed.actualSpend)} / ${formatTaka(summaryCards.budgetUsed.monthlyBudget)}`}>
              {formatTaka(summaryCards.budgetUsed.actualSpend)} / {formatTaka(summaryCards.budgetUsed.monthlyBudget)}
            </p>
          </div>
        </div>
      </div>

      {/* ALERTS BOX (3 Key Actionable Warnings) */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-900">
            জরুরি সতর্কতা ও মনিটরিং নোটিশ (Alerts & Action Items)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Alert 1: Bottom Products */}
          <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-amber-600" />
                  এই সপ্তাহে কোন পণ্য কম বিক্রি
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                  বটম ভলিউম
                </span>
              </div>
              {alerts.bottomProducts.length === 0 ? (
                <p className="text-xs text-slate-500">কোনো পণ্য তালিকাভুক্ত নেই।</p>
              ) : (
                <ul className="space-y-1 mt-2 text-xs text-slate-700">
                  {alerts.bottomProducts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                      <span className="font-medium truncate">{p.name_bn}</span>
                      <span className="font-bold text-rose-600 shrink-0">
                        {toBengaliDigits(p.quantity)} {p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link
              href="/admin/products"
              className="mt-3 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
            >
              <span>পণ্য ও স্টক পরিচালনা করুন</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Alert 2: Stale Qualified Leads */}
          <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
                  ৩+ দিন ধরে অর্ডার হয়নি এমন ক্রেতা
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                  কোয়ালিফাইড
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-rose-600">
                  {toBengaliDigits(alerts.staleQualifiedLeadsCount)} <span className="text-xs font-normal text-slate-500">জন</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {alerts.staleQualifiedLeadsCount > 0
                    ? 'কোয়ালিফাইড স্ট্যাটাসে ৩ বা ততোধিক দিন ধরে কোনো অর্ডার কনফার্ম হয়নি।'
                    : 'বর্তমানে সব কোয়ালিফাইড লিডের ফলো-আপ সময়মতো চলছে।'}
                </p>
              </div>
            </div>
            <Link
              href="/admin/leads?status=QUALIFIED"
              className="mt-3 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 inline-flex items-center gap-1"
            >
              <span>লিডস পাইপলাইনে ফলো-আপ করুন</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Alert 3: Over-Budget Campaigns */}
          <div className="rounded-xl border border-amber-200/80 bg-white p-3.5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5 text-rose-600" />
                  বাজেট ১০০%-এর বেশি ক্যাম্পেইন
                </span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-bold">
                  ওভার-বাজেট
                </span>
              </div>
              {alerts.overBudgetCampaigns.length === 0 ? (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>কোনো ক্যাম্পেইন ওভার-বাজেট নেই</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    সব চলমান ক্যাম্পেইনের খরচ নির্ধারিত সীমার ভেতরে রয়েছে।
                  </p>
                </div>
              ) : (
                <ul className="space-y-1 mt-2 text-xs text-slate-700">
                  {alerts.overBudgetCampaigns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-bold text-rose-600 shrink-0">
                        {toBengaliDigits(c.overPercentage)}% ব্যবহৃত
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link
              href="/admin/campaigns"
              className="mt-3 text-[11px] font-bold text-rose-700 hover:text-rose-800 inline-flex items-center gap-1"
            >
              <span>ক্যাম্পেইন বাজেট সমন্বয় করুন</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 5 RESPONSIVE RECHARTS CHARTS (Section 8.1 & Section 9) */}
      <DashboardCharts
        sectionTargets={charts.sectionTargets}
        teamScoreShare={charts.teamScoreShare}
        dailyTeamTrend={charts.dailyTeamTrend}
        campaignBudgets={charts.campaignBudgets}
        leadSources={charts.leadSources}
      />
    </div>
  );
}
