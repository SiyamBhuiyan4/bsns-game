'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Download,
  Save,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Award,
  DollarSign,
  Layers,
  PieChart as PieIcon,
  Megaphone,
  FileSpreadsheet,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { MonthlyAutoData } from '@/lib/reports';

interface MonthlyReportData {
  id: string;
  month: string;
  status: 'DRAFT' | 'FINAL';
  summary_text: string | null;
  next_month_goal: string | null;
  next_month_budget: number | string | null;
  auto_data: MonthlyAutoData;
  created_at: string;
  finalized_at: string | null;
  creator?: { id: string; name: string; email: string } | null;
}

interface HistoryItem {
  id: string;
  month: string;
  status: 'DRAFT' | 'FINAL';
  created_at: string;
  finalized_at: string | null;
}

const COLORS = ['#059669', '#0EA5E9', '#F59E0B', '#8B5CF6', '#94A3B8', '#64748B'];

function getOffsetMonth(offsetMonths: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function MonthlyReportContent() {
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('month');

  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('month');
      if (p && /^\d{4}-\d{2}$/.test(p)) return p;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam !== currentMonth) {
      setCurrentMonth(monthParam);
    }
  }, [monthParam, currentMonth]);

  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for Section 7 & 8
  const [summaryText, setSummaryText] = useState<string>('');
  const [nextMonthGoal, setNextMonthGoal] = useState<string>('');
  const [nextMonthBudget, setNextMonthBudget] = useState<string>('');

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchReport = async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/monthly?month=${month}&history=true`);
      if (!res.ok) {
        throw new Error('Failed to fetch monthly report');
      }
      const data = await res.json();
      setReport(data.report);
      setHistory(data.history || []);
      setSummaryText(data.report.summary_text || '');
      setNextMonthGoal(data.report.next_month_goal || '');
      setNextMonthBudget(
        data.report.next_month_budget ? String(Number(data.report.next_month_budget)) : ''
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(currentMonth);
  }, [currentMonth]);

  const handleMonthStep = (offset: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + offset, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
  };

  const handleSave = async (finalize = false) => {
    if (!report) return;
    if (finalize && !confirm('আপনি কি নিশ্চিত যে রিপোর্টটি চূড়ান্ত (FINAL) করতে চান? চূড়ান্ত করার পর আর কোনো পরিবর্তন করা যাবে না।')) {
      return;
    }

    if (finalize) setFinalizing(true);
    else setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/reports/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          summary_text: summaryText,
          next_month_goal: nextMonthGoal,
          next_month_budget: nextMonthBudget ? parseFloat(nextMonthBudget) : null,
          finalize,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save monthly report');
      }

      setReport(data.report);
      setSuccessMsg(
        finalize
          ? 'মাসিক রিপোর্ট সফলভাবে চূড়ান্ত (FINAL) করা হয়েছে!'
          : 'খসড়া রিপোর্ট সফলভাবে সংরক্ষণ করা হয়েছে।'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setSaving(false);
      setFinalizing(false);
    }
  };

  const isFinal = report?.status === 'FINAL';
  const autoData = report?.auto_data;

  // Chart data preparation
  const momChartData = autoData
    ? [
        {
          name: 'বিক্রয় (৳)',
          বর্তমান: autoData.mom_growth.current.sales,
          পূর্ববর্তী: autoData.mom_growth.previous.sales,
        },
        {
          name: 'মুনাফা (৳)',
          বর্তমান: autoData.mom_growth.current.profit,
          পূর্ববর্তী: autoData.mom_growth.previous.profit,
        },
      ]
    : [];

  const productChartData = (autoData?.top_products || []).slice(0, 5).map((p) => ({
    name: p.product_name_bn,
    value: p.revenue,
  }));

  const growthBadge = (pct: number) => (
    <span className={`badge ${pct >= 0 ? 'badge-green' : 'badge-red'}`}>
      {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pct >= 0 ? '+' : ''}
      {pct}%
    </span>
  );

  const pctBadge = (pct: number) => (
    <span className={`badge ${pct >= 100 ? 'badge-green' : pct >= 70 ? 'badge-amber' : 'badge-gray'}`}>
      {pct}%
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            মাসিক রিপোর্ট
            {report && (
              <span className={`badge ${isFinal ? 'badge-green' : 'badge-amber'}`}>
                {isFinal ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {isFinal ? 'চূড়ান্ত' : 'খসড়া'}
              </span>
            )}
          </span>
        }
        subtitle="বিক্রয়, মুনাফা, পোস্ট, সেকশন অর্জন ও বাজেট"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setCurrentMonth(getOffsetMonth(0))}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  currentMonth === getOffsetMonth(0)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                চলতি মাস
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(getOffsetMonth(1))}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  currentMonth === getOffsetMonth(1)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                গত মাস
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(getOffsetMonth(2))}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  currentMonth === getOffsetMonth(2)
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ২ মাস আগে
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMonthStep(-1)}
                className="btn-icon"
                title="পূর্ববর্তী মাস"
                aria-label="পূর্ববর্তী মাস"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <label className="sr-only" htmlFor="monthly-month">মাস</label>
              <input
                id="monthly-month"
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="input w-auto"
              />
              <button
                onClick={() => handleMonthStep(1)}
                className="btn-icon"
                title="পরবর্তী মাস"
                aria-label="পরবর্তী মাস"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <a
              href={`/api/reports/monthly/export?month=${currentMonth}&type=excel`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </a>
            <a
              href={`/api/reports/monthly/export?month=${currentMonth}&type=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
          </div>
        }
      />

      {error && (
        <div className="alert alert-error">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="card flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
            <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
          </div>
        </div>
      ) : !autoData ? (
        <div className="card">
          <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="কোনো তথ্য পাওয়া যায়নি" />
        </div>
      ) : (
        <>
          {/* MoM growth */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label={<span className="flex items-center gap-2">মোট বিক্রয় {growthBadge(autoData.mom_growth.growth_pct.sales)}</span>}
              value={`৳ ${autoData.mom_growth.current.sales.toLocaleString()}`}
              note={`আগের মাস ৳ ${autoData.mom_growth.previous.sales.toLocaleString()} · পার্থক্য ৳ ${autoData.mom_growth.diff.sales.toLocaleString()}`}
              icon={<DollarSign className="h-4 w-4" />}
              tone="brand"
            />
            <StatCard
              label={<span className="flex items-center gap-2">মোট মুনাফা {growthBadge(autoData.mom_growth.growth_pct.profit)}</span>}
              value={`৳ ${autoData.mom_growth.current.profit.toLocaleString()}`}
              note={`আগের মাস ৳ ${autoData.mom_growth.previous.profit.toLocaleString()} · পার্থক্য ৳ ${autoData.mom_growth.diff.profit.toLocaleString()}`}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="blue"
            />
            <StatCard
              label={<span className="flex items-center gap-2">গ্রুপ পোস্ট {growthBadge(autoData.mom_growth.growth_pct.posts)}</span>}
              value={`${autoData.mom_growth.current.posts.toLocaleString()} টি`}
              note={`আগের মাস ${autoData.mom_growth.previous.posts.toLocaleString()} টি · পার্থক্য ${autoData.mom_growth.diff.posts.toLocaleString()} টি`}
              icon={<Layers className="h-4 w-4" />}
              tone="violet"
            />
          </div>

          {isMounted && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">মাসভিত্তিক তুলনা</h2>
                  <p className="card-subtitle">চলতি বনাম আগের মাস</p>
                </div>
              </div>
              <div className="card-body h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={momChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(val) => `৳ ${Number(val || 0).toLocaleString()}`}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: 12 }}
                    />
                    <Bar dataKey="পূর্ববর্তী" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="বর্তমান" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Rankings */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <Award className="h-4 w-4 text-slate-400" />
                  মার্কেটার র‍্যাংকিং
                </h2>
                <p className="card-subtitle">মাসিক স্কোর, পোস্ট ও বিক্রয়ের ভিত্তিতে</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-pro">
                <thead>
                  <tr>
                    <th>র‍্যাংক</th>
                    <th>নাম</th>
                    <th className="text-right">গ্রুপ পোস্ট</th>
                    <th className="text-right">বিক্রয় (৳)</th>
                    <th className="text-right">মুনাফা (৳)</th>
                    <th className="text-center">স্কোর</th>
                    <th className="text-center">সম্মাননা</th>
                  </tr>
                </thead>
                <tbody>
                  {autoData.employee_rankings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400">
                        কোনো মার্কেটারের ডেটা পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    autoData.employee_rankings.map((emp) => (
                      <tr key={emp.employee_id}>
                        <td className="font-semibold tabular-nums text-slate-700">#{emp.rank}</td>
                        <td className="whitespace-nowrap">
                          <div className="font-medium text-slate-900">{emp.employee_name}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </td>
                        <td className="text-right tabular-nums">{emp.posts_done} টি</td>
                        <td className="text-right font-medium tabular-nums text-slate-900">
                          ৳ {emp.sales_amount.toLocaleString()}
                        </td>
                        <td className="text-right tabular-nums">৳ {emp.profit_amount.toLocaleString()}</td>
                        <td className="text-center">
                          <span className={`badge ${emp.score >= 80 ? 'badge-green' : 'badge-red'}`}>
                            {emp.score}%
                          </span>
                        </td>
                        <td className="text-center">
                          {emp.is_top_performer ? (
                            <span className="badge badge-amber">Top Performer</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">বাজেট বনাম প্রকৃত খরচ</h2>
                <p className="card-subtitle">মাসিক মার্কেটিং বাজেটের অবস্থা</p>
              </div>
            </div>
            <div className="card-body space-y-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'নির্ধারিত বাজেট', value: `৳ ${autoData.budget_summary.monthly_budget.toLocaleString()}`, cls: 'text-slate-900' },
                  { label: 'প্রকৃত খরচ', value: `৳ ${autoData.budget_summary.actual_spend.toLocaleString()}`, cls: 'text-slate-900' },
                  { label: 'ব্যবহার', value: `${autoData.budget_summary.percentage_used}%`, cls: 'text-slate-900' },
                  {
                    label: 'অবশিষ্ট',
                    value: `৳ ${autoData.budget_summary.remaining.toLocaleString()}`,
                    cls: autoData.budget_summary.remaining >= 0 ? 'text-brand-700' : 'text-rose-600',
                  },
                ].map((m) => (
                  <div key={m.label} className="min-w-0">
                    <span className="block text-xs text-slate-500">{m.label}</span>
                    <span className={`mt-1 block truncate text-lg font-semibold tabular-nums ${m.cls}`}>{m.value}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>বাজেট ব্যবহার</span>
                  <span className="tabular-nums">{autoData.budget_summary.percentage_used}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      autoData.budget_summary.percentage_used > 100
                        ? 'bg-rose-500'
                        : autoData.budget_summary.percentage_used > 85
                        ? 'bg-amber-500'
                        : 'bg-brand-600'
                    }`}
                    style={{ width: `${Math.min(100, autoData.budget_summary.percentage_used)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Section targets */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">সেকশনভিত্তিক টার্গেট ও অর্জন</h2>
                <p className="card-subtitle">পোস্ট ও বিক্রয় টার্গেটের বিপরীতে ফলাফল</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-pro">
                <thead>
                  <tr>
                    <th>সেকশন</th>
                    <th className="text-right">পোস্ট টার্গেট</th>
                    <th className="text-right">সম্পন্ন পোস্ট</th>
                    <th className="text-center">পোস্ট অর্জন</th>
                    <th className="text-right">বিক্রয় টার্গেট (৳)</th>
                    <th className="text-right">প্রকৃত বিক্রয় (৳)</th>
                    <th className="text-center">বিক্রয় অর্জন</th>
                  </tr>
                </thead>
                <tbody>
                  {autoData.section_achievements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400">
                        কোনো সেকশন টার্গেট নির্ধারিত নেই
                      </td>
                    </tr>
                  ) : (
                    autoData.section_achievements.map((s) => (
                      <tr key={s.section_id}>
                        <td className="whitespace-nowrap font-medium text-slate-900">{s.section_name}</td>
                        <td className="text-right tabular-nums">{s.posts_target} টি</td>
                        <td className="text-right tabular-nums">{s.posts_actual} টি</td>
                        <td className="text-center">{pctBadge(s.posts_pct)}</td>
                        <td className="text-right tabular-nums">৳ {s.sales_target.toLocaleString()}</td>
                        <td className="text-right font-medium tabular-nums text-slate-900">৳ {s.sales_actual.toLocaleString()}</td>
                        <td className="text-center">{pctBadge(s.sales_pct)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Products & Channels */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-slate-400" />
                    শীর্ষ বিক্রিত পণ্য
                  </h2>
                  <p className="card-subtitle">রাজস্ব অনুযায়ী</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table-pro">
                  <thead>
                    <tr>
                      <th>পণ্য</th>
                      <th className="text-right">পরিমাণ</th>
                      <th className="text-right">রাজস্ব (৳)</th>
                      <th className="text-right">শেয়ার</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoData.top_products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-slate-400">
                          কোনো পণ্য বিক্রয়ের রেকর্ড নেই
                        </td>
                      </tr>
                    ) : (
                      autoData.top_products.slice(0, 5).map((p) => (
                        <tr key={p.product_id}>
                          <td>
                            <span className="font-medium text-slate-900">{p.product_name_bn}</span>
                            <span className="block text-xs text-slate-500">{p.product_name_en}</span>
                          </td>
                          <td className="text-right tabular-nums whitespace-nowrap">
                            {p.quantity} {p.unit}
                          </td>
                          <td className="text-right font-medium tabular-nums text-slate-900">
                            ৳ {p.revenue.toLocaleString()}
                          </td>
                          <td className="text-right tabular-nums">{p.revenue_share_pct}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {isMounted && productChartData.length > 0 && (
                <div className="h-52 w-full border-t border-slate-100 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={10}
                      >
                        {productChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => `৳ ${Number(val || 0).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-slate-400" />
                    চ্যানেল পারফরম্যান্স
                  </h2>
                  <p className="card-subtitle">উৎসভিত্তিক লিড ও কনভার্সন</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {autoData.channel_breakdown.map((ch) => (
                  <li key={ch.channel} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{ch.channel_bn}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        লিড {ch.leads_count} · অর্ডার {ch.orders_count}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium tabular-nums text-slate-900">৳ {ch.total_amount.toLocaleString()}</div>
                      <span className="text-xs text-slate-500">কনভার্সন {ch.conversion_rate}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Summary & next month plan */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    মাসিক সারসংক্ষেপ
                  </h2>
                  <p className="card-subtitle">কর্মীদের পারফরম্যান্সের মূল্যায়ন</p>
                </div>
              </div>
              <div className="card-body">
                <label className="sr-only" htmlFor="monthly-summary">মাসিক সারসংক্ষেপ</label>
                <textarea
                  id="monthly-summary"
                  rows={7}
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  disabled={isFinal}
                  placeholder="অগ্রগতি, প্রধান অর্জন ও দুর্বলতা লিখুন..."
                  className="input"
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    পরবর্তী মাসের পরিকল্পনা
                  </h2>
                  <p className="card-subtitle">অগ্রাধিকার ও প্রস্তাবিত বাজেট</p>
                </div>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="monthly-goal">প্রধান লক্ষ্য</label>
                  <textarea
                    id="monthly-goal"
                    rows={3}
                    value={nextMonthGoal}
                    onChange={(e) => setNextMonthGoal(e.target.value)}
                    disabled={isFinal}
                    placeholder="কোন পণ্য, চ্যানেল বা সেকশনে জোর দেওয়া হবে..."
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="monthly-budget">প্রস্তাবিত বাজেট (৳)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-400">
                      ৳
                    </span>
                    <input
                      id="monthly-budget"
                      type="number"
                      value={nextMonthBudget}
                      onChange={(e) => setNextMonthBudget(e.target.value)}
                      disabled={isFinal}
                      placeholder="যেমন: 50000"
                      className="input pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action footer */}
          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">
                {isFinal ? 'রিপোর্টটি চূড়ান্ত ও লক করা' : 'খসড়া সংরক্ষণ বা চূড়ান্ত করুন'}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {report.finalized_at
                  ? `চূড়ান্তকারী: ${report.creator?.name || 'Admin'} · ${new Date(
                      report.finalized_at
                    ).toLocaleDateString('bn-BD')}`
                  : 'খসড়া পরে বদলানো যাবে। চূড়ান্ত করলে আর কোনো পরিবর্তন করা যাবে না।'}
              </div>
            </div>

            {!isFinal ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving || finalizing}
                  className="btn btn-secondary"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'খসড়া সংরক্ষণ'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || finalizing}
                  className="btn btn-primary"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {finalizing ? 'চূড়ান্ত করা হচ্ছে...' : 'চূড়ান্ত করুন'}
                </button>
              </div>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                লক করা
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  আগের মাসের রিপোর্ট
                </h3>
              </div>
              <div className="card-body flex flex-wrap gap-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentMonth(item.month)}
                    className={`btn btn-sm ${
                      item.month === currentMonth
                        ? 'border border-brand-600 bg-brand-50 text-brand-800'
                        : 'btn-secondary'
                    }`}
                  >
                    <span className="tabular-nums">{item.month}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.status === 'FINAL' ? 'bg-brand-500' : 'bg-amber-400'
                      }`}
                      aria-label={item.status === 'FINAL' ? 'চূড়ান্ত' : 'খসড়া'}
                    ></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MonthlyReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <MonthlyReportContent />
    </Suspense>
  );
}
