'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  ShoppingBag,
  Target,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import { EmployeeScoreResult, SectionScoreDetail, MetricScoreDetail } from '@/lib/scoring';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

interface PerformanceTrendDay {
  date: string;
  score: number;
  sales: number;
  posts: number;
}

interface ProductSalesSummary {
  name_bn: string;
  quantity: number;
  amount: number;
}

interface PerformanceResponse {
  period: string;
  start_date: string;
  end_date: string;
  assigned_sections: string[];
  score_result: EmployeeScoreResult;
  trend: PerformanceTrendDay[];
  product_sales: ProductSalesSummary[];
}

// Theme variables, so the charts follow light / dark mode like the rest of the page.
const PIE_COLORS = [
  'var(--color-brand-600)',
  'var(--color-sky-500)',
  'var(--color-amber-500)',
  'var(--color-violet-500)',
  'var(--color-rose-500)',
];

/** Section and metric names in both languages, keyed by code, so a language switch needs no refetch. */
const SECTION_LABELS: Record<string, [string, string]> = {
  SALES_PROFIT: ['বিক্রি ও লাভ', 'Sales & profit'],
  CONTENT: ['কনটেন্ট ও পোস্ট', 'Content & posts'],
  NEW_BUYERS_B2B: ['নতুন ক্রেতা ও B2B', 'New buyers & B2B'],
  RETENTION: ['পুরোনো ক্রেতা ধরে রাখা', 'Retention'],
  INBOX_FOLLOWUP: ['ইনবক্স ও ফলোআপ', 'Inbox & follow-up'],
};
const METRIC_LABELS: Record<string, [string, string]> = {
  POSTS_DONE: ['পোস্ট সম্পন্ন', 'Posts done'],
  SALES_AMOUNT: ['মোট বিক্রি', 'Total sales'],
  PROFIT_AMOUNT: ['লাভ', 'Profit'],
  NEW_CLIENTS: ['নতুন ক্রেতা', 'New clients'],
  B2B_ORDERS: ['B2B অর্ডার', 'B2B orders'],
  RETENTION_COUNT: ['পুরোনো ক্রেতার পুনঃঅর্ডার', 'Repeat orders'],
  FOLLOWUPS_DONE: ['ফলোআপ সম্পন্ন', 'Follow-ups done'],
};
const SECTION_TILES = ['', 'icon-tile-sky', 'icon-tile-amber', 'icon-tile-violet', 'icon-tile-rose'];

export default function EmployeePerformancePage() {
  const { lang, L, formatNum, formatMoney } = useLanguage();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParam = new URLSearchParams(window.location.search).get('period');
      if (urlParam === 'daily' || urlParam === 'weekly' || urlParam === 'monthly') {
        setPeriod(urlParam);
      }
    }
  }, []);

  const fetchPerformance = useCallback(async (p: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/employee/performance?period=${p}`);
      if (!res.ok) {
        throw new Error(L('পারফরম্যান্স ডাটা লোড করতে ব্যর্থ হয়েছে', 'Could not load your performance'));
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPerformance(period);
  }, [period, fetchPerformance]);

  if (loading && !data) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-xl sm:w-48" />
        </div>
        <SkeletonStatCards count={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card p-5">
              <Skeleton className="mb-4 h-4 w-36" />
              <Skeleton className="h-52 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data && errorMsg) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<TrendingUp className="h-5 w-5" />}
          title={L('পারফরম্যান্স', 'Performance')}
          subtitle={L('লক্ষ্য অর্জন, স্কোর ও অগ্রগতি', 'Targets, score and progress')}
        />
        <div className="card">
          <ErrorState title={errorMsg} onRetry={() => fetchPerformance(period)} retrying={loading} />
        </div>
      </div>
    );
  }

  const scoreResult = data?.score_result;
  const totalScore = scoreResult?.totalScore ?? 0;
  const isFailing = scoreResult?.isFailing ?? false;
  const hasNoTargets = scoreResult?.hasNoTargets ?? false;
  const sectionLabel = (sec: SectionScoreDetail) =>
    SECTION_LABELS[sec.sectionKey] ? L(...SECTION_LABELS[sec.sectionKey]) : sec.bengaliName.split('(')[0].trim();
  const metricLabel = (m: MetricScoreDetail) =>
    METRIC_LABELS[m.metricType] ? L(...METRIC_LABELS[m.metricType]) : m.bengaliName;
  const metricValue = (m: MetricScoreDetail, v: number | null) =>
    v === null || v === undefined ? '—' : m.metricType.includes('AMOUNT') ? formatMoney(v) : formatNum(v);
  /** yyyy-mm-dd -> "12 Oct 2026"; the raw text when it does not parse. */
  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00+06:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Dhaka',
    }).format(d);
  };
  const failingRatio = scoreResult?.failingThreshold ?? 0.8;
  const threshold = Math.round(failingRatio * 100);
  const sections: Record<string, SectionScoreDetail> = scoreResult?.sections || {};
  const metrics: Record<string, MetricScoreDetail> = (scoreResult?.metrics as Record<string, MetricScoreDetail>) || {};
  const trend = data?.trend || [];
  const productSales = data?.product_sales || [];

  // Bar chart data for components
  const componentChartData = (Object.values(sections) as SectionScoreDetail[]).map((s) => ({
    name: sectionLabel(s),
    weight: s.weight,
    score: s.scaledScore,
    percentage: s.weight > 0 ? Math.round((s.score / s.weight) * 100) : 0,
  }));

  // Pie chart data for product distribution
  const pieData = productSales.map((ps: ProductSalesSummary) => ({
    name: ps.name_bn,
    value: ps.amount,
  }));

  const tooltipStyle = {
    backgroundColor: 'var(--color-white)',
    borderColor: 'var(--color-slate-200)',
    color: 'var(--color-slate-900)',
    borderRadius: '8px',
    fontSize: '11px',
  };

  const achievementTone = (r: number) =>
    r >= 1.0 ? 'text-brand-700' : r >= failingRatio ? 'text-slate-700' : 'text-amber-700';
  const achievementBar = (r: number) =>
    r >= 1.0 ? 'bg-brand-600' : r >= failingRatio ? 'bg-brand-500' : 'bg-amber-500';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<TrendingUp className="h-5 w-5" />}
        title={L('পারফরম্যান্স', 'Performance')}
        subtitle={L('লক্ষ্য অর্জন, স্কোর ও অগ্রগতি', 'Targets, score and progress')}
        actions={
          <div
            role="tablist"
            aria-label={L('সময়কাল', 'Period')}
            className="segmented grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
            aria-busy={loading}
          >
            {(
              [
                ['daily', L('আজ', 'Day')],
                ['weekly', L('সপ্তাহ', 'Week')],
                ['monthly', L('মাস', 'Month')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={period === key}
                className="min-h-10 sm:min-h-0"
                data-active={period === key}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {errorMsg && (
        <div role="alert" className="alert alert-error items-center">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{errorMsg}</span>
          <button type="button" onClick={() => fetchPerformance(period)} className="btn btn-secondary btn-sm min-h-9 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
            {L('আবার চেষ্টা', 'Retry')}
          </button>
        </div>
      )}

      {/* Older figures stay visible (dimmed) while another period loads. */}
      <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      {/* Total score + sections */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card card-body relative flex flex-col justify-between overflow-hidden md:col-span-1">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-violet-500" />
          <div>
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
              <span>{L('মোট স্কোর', 'Total score')}</span>
              <span className="icon-tile">
                <Award className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {formatNum(totalScore)}
              </span>
              <span className="text-sm text-slate-400">/ {formatNum(100)}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            {hasNoTargets ? (
              <span className="badge badge-blue">
                <Target className="h-3 w-3" />
                {L('এখনো টার্গেট দেওয়া হয়নি', 'No targets set yet')}
              </span>
            ) : isFailing ? (
              <span className="badge badge-red">
                <AlertCircle className="h-3 w-3" />
                {L(`উন্নতি প্রয়োজন · ${formatNum(threshold)}% এর নিচে`, `Needs work · below ${formatNum(threshold)}%`)}
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                {L('সন্তোষজনক', 'On track')}
              </span>
            )}
            <p className="text-xs text-slate-500">
              {L('পাস সীমা', 'Pass mark')}: <span className="tabular-nums">{formatNum(threshold)}%</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 lg:grid-cols-3">
          {Object.entries(sections).map(([key, sec]: [string, SectionScoreDetail], index) => {
            const percentAchieved =
              sec.weight > 0 ? Math.min(100, Math.round((sec.scaledScore / sec.weight) * 100)) : 0;
            const isPassingSec = sec.scaledScore >= sec.weight * failingRatio;

            return (
              <div key={key} className="card flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`icon-tile h-7 w-7 rounded-lg ${SECTION_TILES[index % SECTION_TILES.length]}`}>
                        <Layers className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-xs font-medium text-slate-700">{sectionLabel(sec)}</span>
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums">{formatNum(percentAchieved)}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-semibold text-slate-900 tabular-nums">{formatNum(sec.scaledScore)}</span>
                    <span className="text-xs text-slate-400 tabular-nums">
                      / {formatNum(sec.weight)} {L('পয়েন্ট', 'pts')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isPassingSec ? 'bg-brand-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${percentAchieved}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
          <div className="card flex flex-col justify-center gap-1.5 bg-gradient-to-br from-sky-50/80 to-violet-50/60 p-4 text-xs text-slate-600">
            <span className="font-medium text-slate-700">{L('সময়কাল ও সেকশন', 'Period & sections')}</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span className="tabular-nums">
                {data?.start_date === data?.end_date
                  ? fmtDate(data?.start_date)
                  : `${fmtDate(data?.start_date)} – ${fmtDate(data?.end_date)}`}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
              <span>{data?.assigned_sections?.join(', ') || L('কোনো সেকশন নেই', 'No sections')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile icon-tile-sky h-8 w-8 rounded-lg">
                <TrendingUp className="h-4 w-4" />
              </span>
              <h2 className="card-title">{L('গত ১৪ দিন', '14-day trend')}</h2>
            </div>
            <span className="card-subtitle">{L('স্কোর', 'Score')}</span>
          </div>
          <div className="card-body">
            {trend.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <EmptyState icon={<TrendingUp className="h-5 w-5" />} title={L('কোনো ডাটা নেই', 'No data')} />
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-slate-400)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-slate-400)' }} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine
                      y={threshold}
                      label={{ value: L(`${formatNum(threshold)}% পাস`, `${threshold}% pass`), fill: 'var(--color-rose-500)', fontSize: 10 }}
                      stroke="var(--color-rose-500)"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name={L('দৈনিক স্কোর', 'Daily score')}
                      stroke="var(--color-brand-600)"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: 'var(--color-brand-600)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile icon-tile-violet h-8 w-8 rounded-lg">
                <Target className="h-4 w-4" />
              </span>
              <h2 className="card-title">{L('কম্পোনেন্ট পয়েন্ট', 'By component')}</h2>
            </div>
            <span className="card-subtitle">{L('ওয়েটেড', 'Weighted')}</span>
          </div>
          <div className="card-body">
            {componentChartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <EmptyState icon={<Target className="h-5 w-5" />} title={L('কোনো ডাটা নেই', 'No data')} />
              </div>
            ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={componentChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-slate-200)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--color-slate-400)' }} interval={0} />
                  <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: 'var(--color-slate-400)' }} width={32} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="score" name={L('অর্জিত স্কোর', 'Score earned')} fill="var(--color-brand-600)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="weight" name={L('সর্বোচ্চ ওয়েট', 'Max weight')} fill="var(--color-violet-200)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Products + metric detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile icon-tile-amber h-8 w-8 rounded-lg">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <h2 className="card-title">{L('পণ্য বিক্রি', 'Product sales')}</h2>
            </div>
          </div>
          <div className="card-body">
            {pieData.length === 0 ? (
              <div className="flex h-56 items-center justify-center">
                <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title={L('কোনো বিক্রি নেই', 'No sales yet')} />
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" labelLine={false}>
                      {pieData.map((_, index: number) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatMoney(Number(val) || 0)} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile h-8 w-8 rounded-lg">
                <Target className="h-4 w-4" />
              </span>
              <h2 className="card-title">{L('টার্গেট বনাম অর্জন', 'Target vs actual')}</h2>
            </div>
          </div>

          {Object.keys(metrics).length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title={L('কোনো টার্গেট সেট নেই', 'No targets set yet')}
              description={L('অ্যাডমিন টার্গেট দিলে এখানে অগ্রগতি দেখা যাবে।', 'Your progress shows here once your admin sets targets.')}
            />
          ) : (
          <>

          {/* Phone: stacked rows */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {(Object.values(metrics) as MetricScoreDetail[]).map((m) => {
              return (
                <li key={m.metricType} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{metricLabel(m)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {m.isNA ? '—' : formatNum(m.scaledScore)}
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {L('ওয়েট', 'Weight')} {formatNum(m.weight)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs tabular-nums">
                    <span className="text-slate-500">
                      {metricValue(m, m.achieved)}
                      {' / '}
                      {m.isNA ? L('টার্গেট নেই', 'No target') : metricValue(m, m.target)}
                    </span>
                    {m.isNA ? (
                      <span className="badge badge-gray">{L('প্রযোজ্য নয়', 'N/A')}</span>
                    ) : (
                      <span className={`font-medium ${achievementTone(m.rawAchievement)}`}>
                        {formatNum(m.rawAchievement * 100, { decimals: 1 })}%
                      </span>
                    )}
                  </div>
                  {!m.isNA && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${achievementBar(m.rawAchievement)}`}
                        style={{ width: `${Math.min(100, Math.round(m.rawAchievement * 100))}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{L('মেট্রিক', 'Metric')}</th>
                  <th className="text-right">{L('টার্গেট', 'Target')}</th>
                  <th className="text-right">{L('অর্জিত', 'Achieved')}</th>
                  <th>{L('হার', 'Rate')}</th>
                  <th className="text-right">{L('ওয়েট', 'Weight')}</th>
                  <th className="text-right">{L('স্কোর', 'Score')}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(Object.values(metrics) as MetricScoreDetail[]).map((m) => {
                  return (
                    <tr key={m.metricType}>
                      <td>
                        <span className="font-medium text-slate-900">{metricLabel(m)}</span>
                        <span className="block text-[11px] text-slate-400">{m.sectionName}</span>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {m.isNA ? (
                          <span className="text-slate-400">{L('টার্গেট নেই', 'No target')}</span>
                        ) : (
                          metricValue(m, m.target)
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-slate-900">
                        {metricValue(m, m.achieved)}
                      </td>
                      <td>
                        {m.isNA ? (
                          <span className="badge badge-gray">{L('প্রযোজ্য নয়', 'N/A')}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${achievementBar(m.rawAchievement)}`}
                                style={{ width: `${Math.min(100, Math.round(m.rawAchievement * 100))}%` }}
                              />
                            </div>
                            <span className={`font-medium ${achievementTone(m.rawAchievement)}`}>
                              {formatNum(m.rawAchievement * 100, { decimals: 1 })}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-right text-slate-500">{formatNum(m.weight)}%</td>
                      <td className="text-right font-semibold text-slate-900">
                        {m.isNA ? '—' : formatNum(m.scaledScore)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
