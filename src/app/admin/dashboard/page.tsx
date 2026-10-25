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
  Package,
  UserCheck,
  AlertOctagon,
  LayoutDashboard,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
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
  let budgetBarColor = 'bg-brand-600';
  let budgetTone: 'brand' | 'amber' | 'red' = 'brand';

  if (summaryCards.budgetUsed.statusColor === 'red') {
    budgetBarColor = 'bg-rose-500';
    budgetTone = 'red';
  } else if (summaryCards.budgetUsed.statusColor === 'yellow') {
    budgetBarColor = 'bg-amber-500';
    budgetTone = 'amber';
  }

  const planPct = Math.min(100, Math.max(0, planWidget.overallProgress));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`স্বাগতম, ${admin.name}`}
        subtitle="মার্কেটিং পারফরম্যান্স ও বাজেট"
        actions={
          <span className="badge badge-gray py-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            ঢাকা: {toBengaliDigits(periodInfo.todayStr)}
          </span>
        }
      />

      {/* Step-by-step guide for new admins */}
      <SetupChecklist />

      {/* 90-day plan */}
      <div className="card">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title truncate">{planWidget.name}</h2>
            <p className="card-subtitle">
              ৯০ দিনের পরিকল্পনা · দিন {toBengaliDigits(planWidget.currentDay)} / ৯০
            </p>
          </div>
          <Link href="/admin/plan" className="btn btn-secondary btn-sm">
            প্ল্যান দেখুন
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">সার্বিক অগ্রগতি</span>
              <span className="font-semibold text-slate-900 tabular-nums">{toBengaliDigits(planWidget.overallProgress)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${planPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              পর্যায়: <span className="font-medium text-slate-700">{planWidget.currentPhaseName}</span> · সম্পন্ন{' '}
              {toBengaliDigits(planWidget.completedTasksCount)} / {toBengaliDigits(planWidget.totalTasksCount)} টাস্ক
            </p>
          </div>
          <div className="flex items-start sm:justify-end">
            {planWidget.overdueTasksCount > 0 ? (
              <span className="badge badge-red">
                <AlertTriangle className="h-3 w-3" />
                {toBengaliDigits(planWidget.overdueTasksCount)}টি টাস্ক বিলম্বিত
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                কোনো বিলম্বিত টাস্ক নেই
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Period selector */}
      <DashboardPeriodSelector currentPeriod={periodInfo.period} currentFrom={from} currentTo={to} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="সক্রিয় কর্মী"
          icon={<Users className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(summaryCards.activeEmployeesCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </>
          }
        />
        <StatCard
          label="সক্রিয় সেকশন"
          tone="blue"
          icon={<Layers className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(summaryCards.activeSectionsCount)} <span className="text-sm font-normal text-slate-500">টি</span>
            </>
          }
        />
        <StatCard
          label="সম্পন্ন লিংক"
          tone="violet"
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(summaryCards.linksCompletedCount)} <span className="text-sm font-normal text-slate-500">টি</span>
            </>
          }
          note={
            <span className="block truncate" title={periodInfo.label}>
              {periodInfo.label}
            </span>
          }
        />
        <StatCard
          label="শীর্ষ পারফর্মার"
          tone="amber"
          icon={<Trophy className="h-4 w-4" />}
          value={
            <span className="block truncate text-lg" title={summaryCards.topPerformer?.name || 'তথ্য নেই'}>
              {summaryCards.topPerformer ? summaryCards.topPerformer.name : 'তথ্য নেই'}
            </span>
          }
          note={
            summaryCards.topPerformer ? `স্কোর: ${toBengaliDigits(summaryCards.topPerformer.score)}%` : 'ডাটা নেই'
          }
        />
        <StatCard
          label="কম স্কোরের কর্মী"
          tone={summaryCards.failingEmployeesCount > 0 ? 'red' : 'gray'}
          icon={<AlertOctagon className="h-4 w-4" />}
          value={
            <span className={summaryCards.failingEmployeesCount > 0 ? 'text-rose-600' : undefined}>
              {toBengaliDigits(summaryCards.failingEmployeesCount)} <span className="text-sm font-normal text-slate-500">জন</span>
            </span>
          }
          note="স্কোর ৮০%-এর নিচে"
        />
        <StatCard
          label="মাসের বাজেট খরচ"
          tone={budgetTone}
          icon={<Wallet className="h-4 w-4" />}
          value={`${toBengaliDigits(budgetPct)}%`}
          note={
            <>
              <span className="mb-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <span
                  className={`block h-full rounded-full ${budgetBarColor} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, budgetPct))}%` }}
                />
              </span>
              <span
                className="block truncate"
                title={`${formatTaka(summaryCards.budgetUsed.actualSpend)} / ${formatTaka(summaryCards.budgetUsed.monthlyBudget)}`}
              >
                {formatTaka(summaryCards.budgetUsed.actualSpend)} / {formatTaka(summaryCards.budgetUsed.monthlyBudget)}
              </span>
            </>
          }
        />
      </div>

      {/* Alerts */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="card-title">জরুরি সতর্কতা</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {/* Bottom products */}
          <div className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <Package className="h-4 w-4 text-slate-400" />
                এই সপ্তাহে কম বিক্রি পণ্য
              </p>
              {alerts.bottomProducts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">কোনো পণ্য তালিকাভুক্ত নেই।</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {alerts.bottomProducts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name_bn}</span>
                      <span className="shrink-0 font-medium text-rose-600 tabular-nums">
                        {toBengaliDigits(p.quantity)} {p.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href="/admin/products" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
              পণ্য দেখুন
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Stale qualified leads */}
          <div className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <UserCheck className="h-4 w-4 text-slate-400" />
                ৩ দিন ধরে অর্ডার নেই
              </p>
              <div className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums">
                <span className={alerts.staleQualifiedLeadsCount > 0 ? 'text-rose-600' : undefined}>
                  {toBengaliDigits(alerts.staleQualifiedLeadsCount)}
                </span>{' '}
                <span className="text-sm font-normal text-slate-500">জন কোয়ালিফাইড লিড</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {alerts.staleQualifiedLeadsCount > 0 ? 'ফলো-আপ দরকার' : 'সব ঠিক আছে'}
              </p>
            </div>
            <Link
              href="/admin/leads?status=QUALIFIED"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              লিড দেখুন
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Over-budget campaigns */}
          <div className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <AlertOctagon className="h-4 w-4 text-slate-400" />
                বাজেট ১০০%-এর বেশি ক্যাম্পেইন
              </p>
              {alerts.overBudgetCampaigns.length === 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-700">
                  <CheckCircle2 className="h-4 w-4" />
                  সব ক্যাম্পেইন বাজেটের মধ্যে
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  {alerts.overBudgetCampaigns.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 font-medium text-rose-600 tabular-nums">
                        {toBengaliDigits(c.overPercentage)}% ব্যবহৃত
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
              ক্যাম্পেইন দেখুন
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Charts */}
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
