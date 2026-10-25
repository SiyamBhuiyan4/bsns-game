'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
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

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6B7280'];

export default function MonthlyReportPage() {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Month Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">মাসিক পারফরম্যান্স রিপোর্ট</h1>
            {report && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isFinal ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isFinal ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {isFinal ? 'চূড়ান্ত (FINAL)' : 'খসড়া (DRAFT)'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            মাসিক বিক্রয়, মুনাফা, গ্রুপ পোস্ট, সেকশন অর্জন ও বাজেট খরচের পূর্ণাঙ্গ সমন্বিত বিশ্লেষণ
          </p>
        </div>

        {/* Month Picker & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 p-1">
            <button
              onClick={() => handleMonthStep(-1)}
              className="p-1.5 hover:bg-white rounded text-slate-600 transition"
              title="পূর্ববর্তী মাস"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="month"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => handleMonthStep(1)}
              className="p-1.5 hover:bg-white rounded text-slate-600 transition"
              title="পরবর্তী মাস"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Export Dropdowns */}
          <a
            href={`/api/reports/monthly/export?month=${currentMonth}&type=excel`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel ডাউনলোড
          </a>
          <a
            href={`/api/reports/monthly/export?month=${currentMonth}&type=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-sm transition"
          >
            <Download className="h-4 w-4" />
            PDF ডাউনলোড
          </a>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-center gap-2 text-sm text-red-800">
          <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-white border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-600">মাসিক ডেটা লোড করা হচ্ছে...</p>
          </div>
        </div>
      ) : !autoData ? (
        <div className="rounded-xl bg-white p-8 text-center border border-slate-200 text-slate-500">
          কোনো তথ্য পাওয়া যায়নি।
        </div>
      ) : (
        <>
          {/* SECTION 1: Month-over-Month (MoM) Growth */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  সেকশন ১: মাসভিত্তিক প্রবৃদ্ধি (Month-over-Month Growth)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  পূর্ববর্তী মাসের সাথে চলতি মাসের পারফরম্যান্সের তুলনামূলক চিত্র
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Sales Card */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/30 p-5 border border-emerald-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800">মোট বিক্রয় (Sales)</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      autoData.mom_growth.growth_pct.sales >= 0
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {autoData.mom_growth.growth_pct.sales >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {autoData.mom_growth.growth_pct.sales >= 0 ? '+' : ''}
                    {autoData.mom_growth.growth_pct.sales}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">
                  ৳ {autoData.mom_growth.current.sales.toLocaleString()}
                </div>
                <div className="mt-2 text-xs text-slate-500 flex justify-between">
                  <span>পূর্ববর্তী মাস: ৳ {autoData.mom_growth.previous.sales.toLocaleString()}</span>
                  <span className="font-semibold text-slate-700">
                    পার্থক্য: ৳ {autoData.mom_growth.diff.sales.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Profit Card */}
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/30 p-5 border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800">মোট মুনাফা (Profit)</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      autoData.mom_growth.growth_pct.profit >= 0
                        ? 'bg-blue-200 text-blue-900'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {autoData.mom_growth.growth_pct.profit >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {autoData.mom_growth.growth_pct.profit >= 0 ? '+' : ''}
                    {autoData.mom_growth.growth_pct.profit}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">
                  ৳ {autoData.mom_growth.current.profit.toLocaleString()}
                </div>
                <div className="mt-2 text-xs text-slate-500 flex justify-between">
                  <span>পূর্ববর্তী মাস: ৳ {autoData.mom_growth.previous.profit.toLocaleString()}</span>
                  <span className="font-semibold text-slate-700">
                    পার্থক্য: ৳ {autoData.mom_growth.diff.profit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Posts Card */}
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50/30 p-5 border border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-800">গ্রুপ পোস্ট সম্পন্ন (Posts)</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      autoData.mom_growth.growth_pct.posts >= 0
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {autoData.mom_growth.growth_pct.posts >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {autoData.mom_growth.growth_pct.posts >= 0 ? '+' : ''}
                    {autoData.mom_growth.growth_pct.posts}%
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">
                  {autoData.mom_growth.current.posts.toLocaleString()} টি
                </div>
                <div className="mt-2 text-xs text-slate-500 flex justify-between">
                  <span>পূর্ববর্তী মাস: {autoData.mom_growth.previous.posts.toLocaleString()} টি</span>
                  <span className="font-semibold text-slate-700">
                    পার্থক্য: {autoData.mom_growth.diff.posts.toLocaleString()} টি
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Bar Comparison */}
            {isMounted && (
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={momChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                    <YAxis stroke="#64748B" fontSize={12} />
                    <Tooltip
                      formatter={(val) => `৳ ${Number(val || 0).toLocaleString()}`}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    />
                    <Bar dataKey="পূর্ববর্তী" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="বর্তমান" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* SECTION 2: Employee Performance Ranking */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                সেকশন ২: মার্কেটার পারফরম্যান্স ও মাসিক র‍্যাংকিং
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                মাসিক মোট স্কোর, লিংক পোস্টিং, বিক্রয় ও অর্জিত ফলাফলের ভিত্তিতে টিম লিডারবোর্ড
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">র‌্যাংক</th>
                    <th className="py-3 px-4">মার্কেটার নাম</th>
                    <th className="py-3 px-4">গ্রুপ পোস্ট</th>
                    <th className="py-3 px-4">মোট বিক্রয় (৳)</th>
                    <th className="py-3 px-4">মোট মুনাফা (৳)</th>
                    <th className="py-3 px-4">মাসিক স্কোর</th>
                    <th className="py-3 px-4 text-center">সম্মাননা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {autoData.employee_rankings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        কোনো মার্কেটারের ডেটা পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    autoData.employee_rankings.map((emp) => (
                      <tr
                        key={emp.employee_id}
                        className={`hover:bg-slate-50/60 transition ${
                          emp.is_top_performer ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          {emp.rank === 1 ? '🥇 1' : emp.rank === 2 ? '🥈 2' : emp.rank === 3 ? '🥉 3' : `#${emp.rank}`}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{emp.employee_name}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {emp.posts_done} টি
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ৳ {emp.sales_amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-700 font-semibold">
                          ৳ {emp.profit_amount.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block font-black px-2.5 py-0.5 rounded text-xs ${
                              emp.score >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {emp.score}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {emp.is_top_performer ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm border border-amber-200">
                              🏆 Top Performer
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: Budget vs Actual Spend */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                সেকশন ৩: বাজেট বনাম প্রকৃত খরচ (Budget vs Actual Spend)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                মাসিক নির্ধারিত মার্কেটিং বাজেট ও প্রকৃত খরচের বর্তমান স্থিতি
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-500">নির্ধারিত বাজেট (Budget)</span>
                <div className="mt-2 text-xl font-black text-slate-900">
                  ৳ {autoData.budget_summary.monthly_budget.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-500">প্রকৃত খরচ (Spend)</span>
                <div className="mt-2 text-xl font-black text-blue-600">
                  ৳ {autoData.budget_summary.actual_spend.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-500">ব্যবহারের হার (% Used)</span>
                <div className="mt-2 text-xl font-black text-slate-900">
                  {autoData.budget_summary.percentage_used}%
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-500">অবশিষ্ট বাজেট (Remaining)</span>
                <div
                  className={`mt-2 text-xl font-black ${
                    autoData.budget_summary.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  ৳ {autoData.budget_summary.remaining.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>বাজেট ব্যবহারের অগ্রগতি</span>
                <span>{autoData.budget_summary.percentage_used}% ব্যবহৃত</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    autoData.budget_summary.percentage_used > 100
                      ? 'bg-red-500'
                      : autoData.budget_summary.percentage_used > 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, autoData.budget_summary.percentage_used)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Section Targets vs Actuals */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                সেকশন ৪: গ্রুপ সেকশনভিত্তিক টার্গেট ও অর্জন
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                প্রতিটি সেকশনের পোস্ট ও বিক্রয় টার্গেটের বিপরীতে প্রকৃত ফলাফল
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">গ্রুপ সেকশন</th>
                    <th className="py-3 px-4">পোস্ট টার্গেট</th>
                    <th className="py-3 px-4">সম্পন্ন পোস্ট</th>
                    <th className="py-3 px-4">পোস্ট অর্জন (%)</th>
                    <th className="py-3 px-4">বিক্রয় টার্গেট (৳)</th>
                    <th className="py-3 px-4">প্রকৃত বিক্রয় (৳)</th>
                    <th className="py-3 px-4">বিক্রয় অর্জন (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {autoData.section_achievements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        কোনো সেকশন টার্গেট নির্ধারিত নেই
                      </td>
                    </tr>
                  ) : (
                    autoData.section_achievements.map((s) => (
                      <tr key={s.section_id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-semibold text-slate-800">{s.section_name}</td>
                        <td className="py-3 px-4 text-slate-600">{s.posts_target} টি</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{s.posts_actual} টি</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold text-xs px-2 py-0.5 rounded ${
                              s.posts_pct >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.posts_pct >= 70
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.posts_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">৳ {s.sales_target.toLocaleString()}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">৳ {s.sales_actual.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold text-xs px-2 py-0.5 rounded ${
                              s.sales_pct >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.sales_pct >= 70
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.sales_pct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 5 & 6: Products & Channels (2-column layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Section 5: Top Products */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-100 pb-3 mb-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <PieIcon className="h-5 w-5 text-purple-600" />
                    সেকশন ৫: শীর্ষ বিক্রিত পণ্য (Top Products)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    চলতি মাসে পরিমাণ ও রাজস্ব আয়ের দিক থেকে শীর্ষ পণ্যসমূহ
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                        <th className="py-2.5 px-3">পণ্য</th>
                        <th className="py-2.5 px-3">পরিমাণ</th>
                        <th className="py-2.5 px-3">রাজস্ব (৳)</th>
                        <th className="py-2.5 px-3">শেয়ার (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {autoData.top_products.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400">
                            কোনো পণ্য বিক্রয়ের রেকর্ড নেই
                          </td>
                        </tr>
                      ) : (
                        autoData.top_products.slice(0, 5).map((p) => (
                          <tr key={p.product_id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-800">{p.product_name_bn}</span>
                              <span className="text-[10px] text-slate-400 block">{p.product_name_en}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {p.quantity} {p.unit}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              ৳ {p.revenue.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-purple-700">
                              {p.revenue_share_pct}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {isMounted && productChartData.length > 0 && (
                <div className="h-48 w-full mt-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={productChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={65}
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

            {/* Section 6: Channels */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-amber-500" />
                  সেকশন ৬: চ্যানেল পারফরম্যান্স (Channel Breakdown)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ফেসবুক, গুগল ও অন্যান্য উৎস হতে আগত লিড ও কনভার্সন হার
                </p>
              </div>

              <div className="space-y-3">
                {autoData.channel_breakdown.map((ch) => (
                  <div
                    key={ch.channel}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{ch.channel_bn}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        লিড: {ch.leads_count} | সফল অর্ডার: {ch.orders_count}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900">
                        ৳ {ch.total_amount.toLocaleString()}
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        কনভার্সন: {ch.conversion_rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 7 & 8: Executive Comments & Next Month Plan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Section 7 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  সেকশন ৭: মাসিক কাজের সারসংক্ষেপ ও মূল্যায়ন
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  হেড অফ মার্কেটিং হিসেবে সামগ্রিক টিম পারফরম্যান্স ও ফলাফলের বিশ্লেষণ লিখুন
                </p>
              </div>

              <textarea
                rows={6}
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                disabled={isFinal}
                placeholder="চলতি মাসের কাজের অগ্রগতি, প্রধান অর্জন ও দুর্বলতাগুলোর সংক্ষিপ্ত বিবরণ দিন..."
                className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {/* Section 8 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  সেকশন ৮: পরবর্তী মাসের পরিকল্পনা ও বাজেট
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  পরবর্তী মাসের জন্য প্রধান অগ্রাধিকার ও প্রস্তাবিত মার্কেটিং বাজেট
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পরবর্তী মাসের প্রধান লক্ষ্যসমূহ (Key Goals)
                  </label>
                  <textarea
                    rows={3}
                    value={nextMonthGoal}
                    onChange={(e) => setNextMonthGoal(e.target.value)}
                    disabled={isFinal}
                    placeholder="পরবর্তী মাসে কোন পণ্য, চ্যানেল বা সেকশনে জোর দেওয়া হবে..."
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    প্রস্তাবিত মার্কেটিং বাজেট (৳)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">
                      ৳
                    </span>
                    <input
                      type="number"
                      value={nextMonthBudget}
                      onChange={(e) => setNextMonthBudget(e.target.value)}
                      disabled={isFinal}
                      placeholder="যেমন: 50000"
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-xl shadow-md">
            <div>
              <div className="text-sm font-bold">
                {isFinal ? 'রিপোর্টটি চূড়ান্ত (FINAL) অবস্থায় সংরক্ষিত আছে' : 'খসড়া সংরক্ষণ অথবা চূড়ান্ত অনুমোদন'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {report.finalized_at
                  ? `চূড়ান্ত অনুমোদনকারী: ${report.creator?.name || 'Admin'} (তারিখ: ${new Date(
                      report.finalized_at
                    ).toLocaleDateString('bn-BD')})`
                  : 'খসড়া সংরক্ষণ করলে পরবর্তীতে আবার পরিবর্তন করা যাবে।'}
              </div>
            </div>

            {!isFinal ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving || finalizing}
                  className="flex items-center gap-2 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'সংরক্ষণ হচ্ছে...' : 'খসড়া সংরক্ষণ'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || finalizing}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {finalizing ? 'চূড়ান্ত করা হচ্ছে...' : 'রিপোর্ট চূড়ান্ত করুন'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                সম্পূর্ণ লকড (Locked)
              </div>
            )}
          </div>

          {/* Past Monthly Reports Archive */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  বিগত মাসের রিপোর্ট আর্কাইভ
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentMonth(item.month)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      item.month === currentMonth
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{item.month}</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.status === 'FINAL' ? 'bg-emerald-500' : 'bg-amber-400'
                      }`}
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
