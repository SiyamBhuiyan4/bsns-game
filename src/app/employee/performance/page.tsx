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

const PIE_COLORS = ['#059669', '#0284c7', '#d97706', '#8b5cf6', '#ec4899'];

export default function EmployeePerformancePage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
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
        throw new Error('পারফরম্যান্স ডাটা লোড করতে ব্যর্থ হয়েছে');
      }
      const json = await res.json();
      setData(json);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance(period);
  }, [period, fetchPerformance]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm font-semibold text-slate-500">পারফরম্যান্স ডাটা লোড হচ্ছে...</div>
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

  return (
    <div className="space-y-6">
      {/* Header & Period Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            আমার পারফরম্যান্স রিপোর্ট (My Performance)
          </h1>
          <p className="text-sm text-slate-500">
            লক্ষ্যমাত্রা অর্জন, পয়েন্ট স্কোরিং এবং অগ্রগতি পর্যবেক্ষণ
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex rounded-lg border border-slate-300 bg-white p-1 text-xs font-semibold shadow-sm">
          <button
            onClick={() => setPeriod('daily')}
            className={`rounded-md px-3.5 py-1.5 transition ${
              period === 'daily'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            আজ (Daily)
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`rounded-md px-3.5 py-1.5 transition ${
              period === 'weekly'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            এই সপ্তাহ (Weekly)
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`rounded-md px-3.5 py-1.5 transition ${
              period === 'monthly'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            এই মাস (Monthly)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3.5 text-xs font-semibold text-red-800 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary KPI Card: Total Score & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-teal-600" />
                মোট অর্জিত স্কোর
              </span>
              <span className="text-[11px] text-slate-400">সর্বোচ্চ ১০০</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight text-slate-900">
                {totalScore}
              </span>
              <span className="text-slate-400 font-bold">/ ১০০</span>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200/80 pt-4">
            {isFailing ? (
              <div className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>উন্নতি প্রয়োজন ({threshold}% এর নিচে)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>সন্তোষজনক ফলাফল ({threshold}% বা তদূর্ধ্ব)</span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              * ন্যূনতম সফলতার মানদণ্ড: {threshold}% পয়েন্ট।
            </p>
          </div>
        </div>

        {/* 5 Component Mini-Cards */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(sections).map(([key, sec]: [string, SectionScoreDetail]) => {
            const bengaliTitle = sec.bengaliName.split('(')[0].trim();
            const englishSubtitle = sec.bengaliName.includes('(')
              ? sec.bengaliName.match(/\((.*?)\)/)?.[1]
              : '';
            const percentAchieved =
              sec.weight > 0 ? Math.min(100, Math.round((sec.scaledScore / sec.weight) * 100)) : 0;
            const isPassingSec = sec.scaledScore >= sec.weight * failingRatio;

            return (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 block truncate" title={sec.bengaliName}>
                      {bengaliTitle}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {percentAchieved}%
                    </span>
                  </div>
                  {englishSubtitle && (
                    <span className="text-[10px] text-slate-400 block truncate">
                      {englishSubtitle}
                    </span>
                  )}
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-slate-900">
                      {sec.scaledScore}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      / {sec.weight} পয়েন্ট
                    </span>
                  </div>
                </div>

                {/* Achievement Bar */}
                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPassingSec ? 'bg-teal-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${percentAchieved}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm flex flex-col justify-center text-xs text-slate-500">
            <span className="font-bold text-slate-700 mb-1">সময়কাল ও সেকশন:</span>
            <div className="flex items-center gap-1 text-[11px] text-slate-600">
              <Calendar className="h-3 w-3" />
              <span>{data?.start_date} হতে {data?.end_date}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1">
              <Layers className="h-3 w-3" />
              <span>{data?.assigned_sections?.join(', ') || 'কোনো সেকশন নেই'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: 14-Day Performance Trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900">
                গত ১৪ দিনের স্কোরের গতিধারা (14-Day Trend)
              </h2>
            </div>
            <span className="text-xs text-slate-400">স্কোর ট্রেন্ড</span>
          </div>

          {trend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              কোনো ডাটা নেই
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <ReferenceLine
                    y={threshold}
                    label={{ value: `${threshold}% পাস সীমা`, fill: '#ef4444', fontSize: 10 }}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="দৈনিক স্কোর"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0d9488' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Component Breakdown Bar Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                কম্পোনেন্ট ভিত্তিক পয়েন্ট অর্জন
              </h2>
            </div>
            <span className="text-xs text-slate-400">ওয়েটেড স্কোর</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={componentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="score" name="অর্জিত স্কোর" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weight" name="সর্বোচ্চ ওয়েট" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product Breakdown & Metrics Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Sales Pie Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              পণ্য বিক্রির অনুপাত (Product Sales)
            </h2>
          </div>

          {pieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              কোনো পণ্য বিক্রির রেকর্ড নেই
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    labelLine={false}
                  >
                    {pieData.map((_, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => formatTaka(Number(val))}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detailed Metrics Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/50 p-4">
            <h2 className="text-sm font-bold text-slate-900">
              টার্গেট বনাম অর্জনের বিস্তারিত বিশ্লেষণ (Target vs Actual)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">মেট্রিক নাম</th>
                  <th className="px-3.5 py-2.5">টার্গেট</th>
                  <th className="px-3.5 py-2.5">অর্জিত</th>
                  <th className="px-3.5 py-2.5">অর্জনের হার</th>
                  <th className="px-3.5 py-2.5">ওয়েট</th>
                  <th className="px-3.5 py-2.5 text-right">স্কোর</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(Object.values(metrics) as MetricScoreDetail[]).map((m) => {
                  const isCurrency = m.metricType.includes('AMOUNT');
                  return (
                    <tr key={m.metricType} className="hover:bg-slate-50/70">
                      <td className="px-3.5 py-2.5">
                        <span className="font-bold text-slate-900">{m.bengaliName}</span>
                        <span className="block text-[10px] text-slate-400">{m.metricType}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {m.isNA
                          ? 'N/A (সেট নেই)'
                          : isCurrency
                          ? formatTaka(m.target)
                          : Number(m.target).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                        {isCurrency ? formatTaka(m.achieved) : Number(m.achieved).toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5">
                        {m.isNA ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            N/A
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  m.rawAchievement >= 1.0
                                    ? 'bg-emerald-500'
                                    : m.rawAchievement >= failingRatio
                                    ? 'bg-teal-500'
                                    : 'bg-amber-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.round(m.rawAchievement * 100))}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`font-bold ${
                                m.rawAchievement >= 1.0
                                  ? 'text-emerald-600'
                                  : m.rawAchievement >= failingRatio
                                  ? 'text-teal-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {(m.rawAchievement * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500">{m.weight}%</td>
                      <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                        {m.isNA ? '-' : m.scaledScore}
                      </td>
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
