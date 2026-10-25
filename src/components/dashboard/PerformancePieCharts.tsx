'use client';

import React, { useState, useMemo } from 'react';
import {
  PieChart as PieIcon,
  Users,
  Share2,
  ShoppingCart,
  MessageSquare,
  UserPlus,
  DollarSign,
  Layers,
  Sparkles,
  BarChart3,
  Award,
} from 'lucide-react';
import ThreeDPieChart, { PieSliceData } from './ThreeDPieChart';
import {
  EmployeeWorkSummaryItem,
  SectionOverviewItem,
  TeamScoreShareItem,
} from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';

interface PerformancePieChartsProps {
  employees: EmployeeWorkSummaryItem[];
  teamScoreShare?: TeamScoreShareItem[];
  sectionsOverview?: SectionOverviewItem[];
}

type ViewCategory = 'OVERALL' | 'BY_METRIC' | 'BY_EMPLOYEE';
type MetricKey = 'POSTS' | 'ORDERS' | 'MESSAGES' | 'LEADS' | 'SALES';

const METRIC_COLORS: Record<MetricKey, string> = {
  POSTS: '#0284c7',      // Sky Blue
  ORDERS: '#059669',     // Emerald Green
  MESSAGES: '#8b5cf6',   // Purple
  LEADS: '#d97706',      // Amber
  SALES: '#ec4899',      // Rose/Pink
};

const EMPLOYEE_PALETTE = [
  '#059669', // Emerald
  '#0284c7', // Sky
  '#d97706', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#0d9488', // Teal
  '#6366f1', // Indigo
  '#f43f5e', // Rose
  '#ea580c', // Orange
  '#84cc16', // Lime
];

export default function PerformancePieCharts({
  employees = [],
  teamScoreShare = [],
  sectionsOverview: _sectionsOverview = [],
}: PerformancePieChartsProps) {
  const { lang, formatMoney, formatNum } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  // States
  const [viewCategory, setViewCategory] = useState<ViewCategory>('OVERALL');
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('POSTS');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    employees.length > 0 ? employees[0].id : ''
  );

  // 1. Overall Aggregates across all employees
  const totals = useMemo(() => {
    return employees.reduce(
      (acc, emp) => {
        acc.posts += emp.metrics.posts_done || 0;
        acc.orders += emp.metrics.orders_confirmed || 0;
        acc.messages += emp.metrics.messages_replied || 0;
        acc.leads += emp.metrics.leads_collected || 0;
        acc.sales += emp.metrics.sales_amount || 0;
        return acc;
      },
      { posts: 0, orders: 0, messages: 0, leads: 0, sales: 0 }
    );
  }, [employees]);

  // Overall Performance Slices: Work Metric Breakdown
  const overallMetricsSlices: PieSliceData[] = useMemo(() => {
    return [
      {
        id: 'posts',
        name: L('গ্রুপ পোস্ট', 'Group Posts'),
        value: totals.posts,
        color: METRIC_COLORS.POSTS,
        unit: L('টি', 'posts'),
      },
      {
        id: 'orders',
        name: L('নিশ্চিত অর্ডার', 'Confirmed Orders'),
        value: totals.orders,
        color: METRIC_COLORS.ORDERS,
        unit: L('টি', 'orders'),
      },
      {
        id: 'messages',
        name: L('মেসেজ রিপ্লাই', 'Messages Replied'),
        value: totals.messages,
        color: METRIC_COLORS.MESSAGES,
        unit: L('টি', 'replies'),
      },
      {
        id: 'leads',
        name: L('লিড সংগ্রহ', 'Leads Collected'),
        value: totals.leads,
        color: METRIC_COLORS.LEADS,
        unit: L('জন', 'leads'),
      },
      {
        id: 'sales',
        name: L('বিক্রয় (হাজার টাকা)', 'Sales (k BDT)'),
        // In thousand Taka so sales scale is comparable to counts
        value: Math.round(totals.sales / 1000) > 0 ? Math.round(totals.sales / 1000) : (totals.sales > 0 ? 1 : 0),
        color: METRIC_COLORS.SALES,
        secondaryValue: formatMoney(totals.sales),
        unit: 'k BDT',
      },
    ].filter((s) => s.value > 0);
  }, [totals, lang, formatMoney]);

  // Overall Performance Slices: Employee Score Share
  const overallEmployeeScoreSlices: PieSliceData[] = useMemo(() => {
    if (teamScoreShare && teamScoreShare.length > 0) {
      return teamScoreShare
        .filter((t) => t.score > 0)
        .map((t, index) => ({
          id: t.employeeId,
          name: t.name,
          value: t.score,
          color: EMPLOYEE_PALETTE[index % EMPLOYEE_PALETTE.length],
          secondaryValue: `${formatNum(t.score)} ${L('পয়েন্ট', 'pts')}`,
        }));
    }

    // Fallback computed from employees
    return employees
      .map((emp, index) => {
        const score =
          (emp.metrics.posts_done || 0) * 1 +
          (emp.metrics.orders_confirmed || 0) * 5 +
          (emp.metrics.leads_collected || 0) * 2 +
          Math.round((emp.metrics.sales_amount || 0) / 100);
        return {
          id: emp.id,
          name: emp.name,
          value: score,
          color: EMPLOYEE_PALETTE[index % EMPLOYEE_PALETTE.length],
        };
      })
      .filter((s) => s.value > 0);
  }, [teamScoreShare, employees, lang, formatNum]);

  // 2. For Each Metric: Breakdown across all employees
  const metricSlices: PieSliceData[] = useMemo(() => {
    return employees
      .map((emp, index) => {
        let val = 0;
        let secondary = '';
        if (selectedMetric === 'POSTS') {
          val = emp.metrics.posts_done || 0;
        } else if (selectedMetric === 'ORDERS') {
          val = emp.metrics.orders_confirmed || 0;
        } else if (selectedMetric === 'MESSAGES') {
          val = emp.metrics.messages_replied || 0;
        } else if (selectedMetric === 'LEADS') {
          val = emp.metrics.leads_collected || 0;
        } else if (selectedMetric === 'SALES') {
          val = emp.metrics.sales_amount || 0;
          secondary = formatMoney(val);
        }

        return {
          id: emp.id,
          name: emp.name,
          value: val,
          color: EMPLOYEE_PALETTE[index % EMPLOYEE_PALETTE.length],
          secondaryValue: secondary,
        };
      })
      .filter((s) => s.value > 0);
  }, [employees, selectedMetric, formatMoney]);

  // 3. For Each Employee: Breakdown across their metrics
  const activeEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || employees[0];
  }, [employees, selectedEmployeeId]);

  const individualEmployeeSlices: PieSliceData[] = useMemo(() => {
    if (!activeEmployee) return [];

    const m = activeEmployee.metrics;
    return [
      {
        id: 'posts',
        name: L('গ্রুপ পোস্ট', 'Group Posts'),
        value: m.posts_done || 0,
        color: METRIC_COLORS.POSTS,
      },
      {
        id: 'orders',
        name: L('নিশ্চিত অর্ডার', 'Confirmed Orders'),
        value: m.orders_confirmed || 0,
        color: METRIC_COLORS.ORDERS,
      },
      {
        id: 'messages',
        name: L('মেসেজ রিপ্লাই', 'Messages Replied'),
        value: m.messages_replied || 0,
        color: METRIC_COLORS.MESSAGES,
      },
      {
        id: 'leads',
        name: L('লিড সংগ্রহ', 'Leads Collected'),
        value: m.leads_collected || 0,
        color: METRIC_COLORS.LEADS,
      },
      {
        id: 'sales',
        name: L('বিক্রয় (হাজার টাকা)', 'Sales (k BDT)'),
        value: Math.round((m.sales_amount || 0) / 1000) > 0 ? Math.round((m.sales_amount || 0) / 1000) : ((m.sales_amount || 0) > 0 ? 1 : 0),
        color: METRIC_COLORS.SALES,
        secondaryValue: formatMoney(m.sales_amount || 0),
      },
    ].filter((s) => s.value > 0);
  }, [activeEmployee, lang, formatMoney]);

  // Selected metric config
  const metricConfigs: Record<
    MetricKey,
    { titleBn: string; titleEn: string; icon: any; total: number; unit: string }
  > = {
    POSTS: {
      titleBn: 'গ্রুপ পোস্ট পারফরম্যান্স',
      titleEn: 'Group Posts Performance',
      icon: Share2,
      total: totals.posts,
      unit: L('টি', 'posts'),
    },
    ORDERS: {
      titleBn: 'নিশ্চিত অর্ডার পারফরম্যান্স',
      titleEn: 'Confirmed Orders Performance',
      icon: ShoppingCart,
      total: totals.orders,
      unit: L('টি', 'orders'),
    },
    MESSAGES: {
      titleBn: 'মেসেজ রিপ্লাই পারফরম্যান্স',
      titleEn: 'Messages Replied Performance',
      icon: MessageSquare,
      total: totals.messages,
      unit: L('টি', 'replies'),
    },
    LEADS: {
      titleBn: 'লিড সংগ্রহ পারফরম্যান্স',
      titleEn: 'Leads Collected Performance',
      icon: UserPlus,
      total: totals.leads,
      unit: L('জন', 'leads'),
    },
    SALES: {
      titleBn: 'মোট বিক্রয় পারফরম্যান্স',
      titleEn: 'Sales Performance',
      icon: DollarSign,
      total: totals.sales,
      unit: 'BDT',
    },
  };

  const currentMetricCfg = metricConfigs[selectedMetric];
  const MetricIcon = currentMetricCfg.icon;

  return (
    <div className="card p-6 shadow-sm border border-slate-200/90 rounded-2xl bg-white space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 shadow-xs border border-brand-200/60">
            <PieIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {L('৩ডি পারফরম্যান্স পাই চার্ট', '3D Performance Pie Charts')}
              </h2>
              <span className="badge badge-brand text-[10px] font-bold uppercase tracking-wider py-0.5">
                3D Interactive
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {L(
                'সার্বিক কাজের বিভাজন এবং প্রতিটি কাজের পারফরম্যান্স ও কর্মীদের বিস্তারিত ৩ডি পাই চার্ট',
                'Overall work ratio, performance by individual task, and employee 3D pie charts'
              )}
            </p>
          </div>
        </div>

        {/* 3 Main View Tabs */}
        <div className="flex items-center rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 self-start md:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setViewCategory('OVERALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewCategory === 'OVERALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>{L('সার্বিক পারফরম্যান্স', 'Overall Performance')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewCategory('BY_METRIC')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewCategory === 'BY_METRIC'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            <span>{L('প্রতিটি পারফরম্যান্স', 'Each Performance')}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewCategory('BY_EMPLOYEE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewCategory === 'BY_EMPLOYEE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-sky-600" />
            <span>{L('প্রতিটি কর্মী', 'Each Employee')}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERALL VIEW: 2 Side-by-Side 3D Pie Charts */}
      {/* ========================================================================= */}
      {viewCategory === 'OVERALL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1A: Overall Metric Distribution */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand-600" />
                  {L('কাজের সামগ্রিক বিভাজন', 'Work Distribution by Category')}
                </h3>
                <p className="text-xs text-slate-400">
                  {L('সব কর্মীর সম্পন্ন করা মোট কাজের অনুপাত', 'Proportion of total work completed')}
                </p>
              </div>
              <span className="badge badge-gray text-xs font-mono font-semibold">
                {formatNum(totals.posts + totals.orders + totals.messages + totals.leads)} {L('টি কাজ', 'tasks')}
              </span>
            </div>

            <ThreeDPieChart
              data={overallMetricsSlices}
              valueFormatter={(v) => formatNum(v)}
              height={300}
              depth={28}
            />
          </div>

          {/* Chart 1B: Employees Overall Score Contribution */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  {L('কর্মীদের সার্বিক অবদানের ভাগ', "Employees' Overall Contribution")}
                </h3>
                <p className="text-xs text-slate-400">
                  {L('মোট স্কোরে কোন কর্মীর কতটুকু অবদান', "Each employee's share of overall score")}
                </p>
              </div>
              <span className="badge badge-brand text-xs font-mono font-semibold">
                {formatNum(employees.length)} {L('জন কর্মী', 'employees')}
              </span>
            </div>

            <ThreeDPieChart
              data={overallEmployeeScoreSlices}
              valueFormatter={(v) => `${formatNum(v)} ${L('পয়েন্ট', 'pts')}`}
              height={300}
              depth={28}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FOR EACH PERFORMANCE / METRIC VIEW */}
      {/* ========================================================================= */}
      {viewCategory === 'BY_METRIC' && (
        <div className="space-y-5">
          {/* Metric Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'POSTS', label: L('গ্রুপ পোস্ট', 'Posts Done'), icon: Share2, count: totals.posts },
                { key: 'ORDERS', label: L('নিশ্চিত অর্ডার', 'Confirmed Orders'), icon: ShoppingCart, count: totals.orders },
                { key: 'MESSAGES', label: L('মেসেজ রিপ্লাই', 'Messages Replied'), icon: MessageSquare, count: totals.messages },
                { key: 'LEADS', label: L('লিড সংগ্রহ', 'Leads Collected'), icon: UserPlus, count: totals.leads },
                { key: 'SALES', label: L('মোট বিক্রয়', 'Sales Amount'), icon: DollarSign, count: formatMoney(totals.sales) },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = selectedMetric === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedMetric(item.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" style={{ color: isSelected ? '#ffffff' : METRIC_COLORS[item.key] }} />
                  <span>{item.label}</span>
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-[11px] font-mono ${
                      isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {typeof item.count === 'number' ? formatNum(item.count) : item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Metric 3D Pie Chart Container */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/90 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/70">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: METRIC_COLORS[selectedMetric] }}
                >
                  <MetricIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {L(currentMetricCfg.titleBn, currentMetricCfg.titleEn)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {L('এই কাজে কর্মীদের অবদান ও অর্জনের ৩ডি অনুপাত', "Employees' 3D distribution for this specific task")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-medium">{L('সর্বমোট অর্জিত', 'Total Achieved')}</div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {selectedMetric === 'SALES' ? formatMoney(totals.sales) : `${formatNum(currentMetricCfg.total)} ${currentMetricCfg.unit}`}
                  </div>
                </div>
              </div>
            </div>

            <ThreeDPieChart
              data={metricSlices}
              valueFormatter={(v) => (selectedMetric === 'SALES' ? formatMoney(v) : `${formatNum(v)} ${currentMetricCfg.unit}`)}
              height={320}
              depth={28}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FOR EACH EMPLOYEE VIEW */}
      {/* ========================================================================= */}
      {viewCategory === 'BY_EMPLOYEE' && (
        <div className="space-y-5">
          {/* Employee Picker Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {employees.map((emp, index) => {
              const isSelected = selectedEmployeeId === emp.id;
              const color = EMPLOYEE_PALETTE[index % EMPLOYEE_PALETTE.length];
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{emp.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {emp.targetProgressPercent}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Individual Employee 3D Pie Chart & Quick Stats Grid */}
          {activeEmployee ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: 3D Pie Chart */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                      {activeEmployee.name} - {L('কাজের ব্যক্তিগত ৩ডি বিভাজন', 'Personal Work 3D Distribution')}
                    </h3>
                    <p className="text-xs text-slate-400">{activeEmployee.email}</p>
                  </div>
                  <span className="badge badge-brand text-xs font-semibold">
                    {L('অগ্রগতি', 'Progress')}: {activeEmployee.targetProgressPercent}%
                  </span>
                </div>

                <ThreeDPieChart
                  data={individualEmployeeSlices}
                  valueFormatter={(v) => formatNum(v)}
                  height={300}
                  depth={28}
                  emptyMessage={L('এই কর্মীর কোনো কাজ রেকর্ড করা হয়নি', 'No activity recorded for this employee')}
                />
              </div>

              {/* Right Col: Personal Stat Highlights */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{L('মোট পোস্ট', 'Total Posts')}</div>
                  <div className="text-xl font-bold font-mono text-sky-700">
                    {formatNum(activeEmployee.metrics.posts_done)} <span className="text-xs font-normal text-slate-500">{L('টি', '')}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{L('নিশ্চিত অর্ডার', 'Confirmed Orders')}</div>
                  <div className="text-xl font-bold font-mono text-emerald-700">
                    {formatNum(activeEmployee.metrics.orders_confirmed)} <span className="text-xs font-normal text-slate-500">{L('টি', '')}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{L('মেসেজ রিপ্লাই', 'Messages Replied')}</div>
                  <div className="text-xl font-bold font-mono text-indigo-700">
                    {formatNum(activeEmployee.metrics.messages_replied)} <span className="text-xs font-normal text-slate-500">{L('টি', '')}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{L('লিড সংগ্রহ', 'Leads Collected')}</div>
                  <div className="text-xl font-bold font-mono text-amber-700">
                    {formatNum(activeEmployee.metrics.leads_collected)} <span className="text-xs font-normal text-slate-500">{L('জন', '')}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">{L('মোট বিক্রয়', 'Sales Amount')}</div>
                  <div className="text-xl font-bold font-mono text-rose-700">
                    {formatMoney(activeEmployee.metrics.sales_amount)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl">
              {L('কোনো কর্মী পাওয়া যায়নি', 'No employee found')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
