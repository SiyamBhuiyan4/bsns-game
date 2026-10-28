'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  ShoppingBag,
  Target,
} from 'lucide-react';
import { formatTaka } from '@/lib/date';
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

export default function EmployeePerformancePage() {
  const { lang, L } = useLanguage();
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
        throw new Error(L('পারফরম্যান্স ডাটা লোড করতে ব্যর্থ হয়েছে'));
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      setLoading(false);
    }
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

  const scoreResult = data?.score_result;
  const totalScore = scoreResult?.totalScore ?? 0;
  const isFailing = scoreResult?.isFailing ?? false;
  const failingRatio = scoreResult?.failingThreshold ?? 0.8;
  const threshold = Math.round(failingRatio * 100);
  const sections: Record<string, SectionScoreDetail> = scoreResult?.sections || {};
  const metrics: Record<string, MetricScoreDetail> = (scoreResult?.metrics as Record<string, MetricScoreDetail>) || {};
  const trend = data?.trend || [];
  const productSales = data?.product_sales || [];

  // Bar chart data for components
  const componentChartData = (Object.values(sections) as SectionScoreDetail[]).map((s) => ({
    name: s.bengaliName.split('(')[0].trim(),
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
          <div className="segmented grid w-full grid-cols-3 sm:inline-flex sm:w-auto" aria-busy={loading}>
            <button type="button" className="min-h-10 sm:min-h-0" data-active={period === 'daily'} onClick={() => setPeriod('daily')}>
              {L('আজ', 'Day')}
            </button>
            <button type="button" className="min-h-10 sm:min-h-0" data-active={period === 'weekly'} onClick={() => setPeriod('weekly')}>
              {L('সপ্তাহ', 'Week')}
            </button>
            <button type="button" className="min-h-10 sm:min-h-0" data-active={period === 'monthly'} onClick={() => setPeriod('monthly')}>
              {L('মাস', 'Month')}
            </button>
          </div>
        }
      />

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Total score + sections */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card card-body flex flex-col justify-between md:col-span-1">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-brand-600" />
                {L('মোট স্কোর', 'Total score')}
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{totalScore}</span>
              <span className="text-sm text-slate-400">{L("/ ১০০")}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            {isFailing ? (
              <span className="badge badge-red">
                <AlertCircle className="h-3 w-3" />
                {L('উন্নতি প্রয়োজন', 'Below')} {threshold}%
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                {L('সন্তোষজনক', `${threshold}%+`)}
              </span>
            )}
            <p className="text-xs text-slate-500">{L('পাস সীমা', 'Pass mark')}: {threshold}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 lg:grid-cols-3">
          {Object.entries(sections).map(([key, sec]: [string, SectionScoreDetail]) => {
            const bengaliTitle = sec.bengaliName.split('(')[0].trim();
            const englishSubtitle = sec.bengaliName.includes('(')
              ? sec.bengaliName.match(/\((.*?)\)/)?.[1]
              : '';
            const percentAchieved =
              sec.weight > 0 ? Math.min(100, Math.round((sec.scaledScore / sec.weight) * 100)) : 0;
            const isPassingSec = sec.scaledScore >= sec.weight * failingRatio;

            return (
              <div key={key} className="card flex flex-col justify-between p-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-700" title={sec.bengaliName}>
                      {bengaliTitle}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{percentAchieved}%</span>
                  </div>
                  {englishSubtitle && (
                    <span className="block truncate text-[11px] text-slate-400">{englishSubtitle}</span>
                  )}
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-semibold text-slate-900 tabular-nums">{sec.scaledScore}</span>
                    <span className="text-xs text-slate-400">/ {sec.weight} {L("পয়েন্ট")}</span>
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
          <div className="card flex flex-col justify-center gap-1.5 bg-slate-50/70 p-4 text-xs text-slate-600">
            <span className="font-medium text-slate-700">{L('সময়কাল ও সেকশন', 'Period')}</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="tabular-nums">
                {data?.start_date} – {data?.end_date}
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{data?.assigned_sections?.join(', ') || L('কোনো সেকশন নেই', 'No sections')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-400" />
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
                      label={{ value: L(`${threshold}% পাস`, `${threshold}% pass`), fill: 'var(--color-rose-500)', fontSize: 10 }}
                      stroke="var(--color-rose-500)"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name={L("দৈনিক স্কোর")}
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
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-400" />
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
                  <Bar dataKey="score" name={L("অর্জিত স্কোর")} fill="var(--color-brand-600)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="weight" name={L("সর্বোচ্চ ওয়েট")} fill="var(--color-slate-200)" radius={[4, 4, 0, 0]} />
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
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-slate-400" />
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
                    <Tooltip formatter={(val) => formatTaka(Number(val))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">{L('টার্গেট বনাম অর্জন', 'Target vs actual')}</h2>
          </div>

          {Object.keys(metrics).length === 0 && (
            <EmptyState icon={<Target className="h-5 w-5" />} title={L('কোনো টার্গেট সেট নেই', 'No targets set yet')} />
          )}

          {/* Phone: stacked rows */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {(Object.values(metrics) as MetricScoreDetail[]).map((m) => {
              const isCurrency = m.metricType.includes('AMOUNT');
              return (
                <li key={m.metricType} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{m.bengaliName}</div>
                      <div className="text-[11px] text-slate-400">{m.metricType}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">{m.isNA ? '-' : m.scaledScore}</div>
                      <div className="text-[11px] text-slate-400">{L("ওয়েট")} {m.weight}%</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs tabular-nums">
                    <span className="text-slate-500">
                      {isCurrency ? formatTaka(m.achieved) : Number(m.achieved).toLocaleString()}
                      {' / '}
                      {m.isNA ? 'N/A' : isCurrency ? formatTaka(m.target) : Number(m.target).toLocaleString()}
                    </span>
                    {m.isNA ? (
                      <span className="badge badge-gray">N/A</span>
                    ) : (
                      <span className={`font-medium ${achievementTone(m.rawAchievement)}`}>
                        {(m.rawAchievement * 100).toFixed(1)}%
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
                  <th>{L("টার্গেট")}</th>
                  <th>{L("অর্জিত")}</th>
                  <th>{L('হার', 'Rate')}</th>
                  <th>{L("ওয়েট")}</th>
                  <th className="text-right">{L("স্কোর")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(Object.values(metrics) as MetricScoreDetail[]).map((m) => {
                  const isCurrency = m.metricType.includes('AMOUNT');
                  return (
                    <tr key={m.metricType}>
                      <td>
                        <span className="font-medium text-slate-900">{m.bengaliName}</span>
                        <span className="block text-[11px] text-slate-400">{m.metricType}</span>
                      </td>
                      <td>
                        {m.isNA
                          ? L('N/A (সেট নেই)')
                          : isCurrency
                          ? formatTaka(m.target)
                          : Number(m.target).toLocaleString()}
                      </td>
                      <td className="font-medium text-slate-900">
                        {isCurrency ? formatTaka(m.achieved) : Number(m.achieved).toLocaleString()}
                      </td>
                      <td>
                        {m.isNA ? (
                          <span className="badge badge-gray">N/A</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${achievementBar(m.rawAchievement)}`}
                                style={{ width: `${Math.min(100, Math.round(m.rawAchievement * 100))}%` }}
                              />
                            </div>
                            <span className={`font-medium ${achievementTone(m.rawAchievement)}`}>
                              {(m.rawAchievement * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-slate-500">{m.weight}%</td>
                      <td className="text-right font-semibold text-slate-900">{m.isNA ? '-' : m.scaledScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
