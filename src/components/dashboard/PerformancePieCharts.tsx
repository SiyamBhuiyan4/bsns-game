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
} from 'lucide-react';
import ThreeDPieChart, { PieSliceData } from './ThreeDPieChart';
import {
  EmployeeWorkSummaryItem,
  SectionOverviewItem,
  TeamScoreShareItem,
} from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';

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
  const { lang, formatMoney, formatNum, L } = useLanguage();

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
      titleBn: L('গ্রুপ পোস্ট পারফরম্যান্স'),
      titleEn: 'Group Posts Performance',
      icon: Share2,
      total: totals.posts,
      unit: L('টি', 'posts'),
    },
    ORDERS: {
      titleBn: L('নিশ্চিত অর্ডার পারফরম্যান্স'),
      titleEn: 'Confirmed Orders Performance',
      icon: ShoppingCart,
      total: totals.orders,
      unit: L('টি', 'orders'),
    },
    MESSAGES: {
      titleBn: L('মেসেজ রিপ্লাই পারফরম্যান্স'),
      titleEn: 'Messages Replied Performance',
      icon: MessageSquare,
      total: totals.messages,
      unit: L('টি', 'replies'),
    },
    LEADS: {
      titleBn: L('লিড সংগ্রহ পারফরম্যান্স'),
      titleEn: 'Leads Collected Performance',
      icon: UserPlus,
      total: totals.leads,
      unit: L('জন', 'leads'),
    },
    SALES: {
      titleBn: L('মোট বিক্রয় পারফরম্যান্স'),
      titleEn: 'Sales Performance',
      icon: DollarSign,
      total: totals.sales,
      unit: 'BDT',
    },
  };

  const currentMetricCfg = metricConfigs[selectedMetric];
  const MetricIcon = currentMetricCfg.icon;

  const viewTabs: { key: ViewCategory; label: string }[] = [
    { key: 'OVERALL', label: L('সার্বিক পারফরম্যান্স', 'Overall Performance') },
    { key: 'BY_METRIC', label: L('প্রতিটি পারফরম্যান্স', 'Each Performance') },
    { key: 'BY_EMPLOYEE', label: L('প্রতিটি কর্মী', 'Each Employee') },
  ];

  const chipClass = (isSelected: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
      isSelected
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
    }`;
  const chipCountClass = (isSelected: boolean) =>
    `rounded-full px-1.5 py-px text-[11px] tabular-nums ${
      isSelected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
    }`;

  return (
    <section className="card">
      {/* Header & mode switcher */}
      <div className="card-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/10">
            <PieIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="card-title">{L('৩ডি পারফরম্যান্স পাই চার্ট', '3D Performance Pie Charts')}</h2>
            <p className="card-subtitle mt-0.5">
              {L(
                'সার্বিক কাজের বিভাজন এবং প্রতিটি কাজের পারফরম্যান্স ও কর্মীদের বিস্তারিত ৩ডি পাই চার্ট',
                'Overall work ratio, performance by individual task, and employee 3D pie charts'
              )}
            </p>
          </div>
        </div>

        <div className="segmented max-w-full flex-wrap" role="group">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setViewCategory(tab.key)}
              data-active={viewCategory === tab.key}
              aria-pressed={viewCategory === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card-body">
      {/* 1. Overall view: two charts side by side */}
      {viewCategory === 'OVERALL' && (
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  {L('কাজের সামগ্রিক বিভাজন', 'Work Distribution by Category')}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {L('সব কর্মীর সম্পন্ন করা মোট কাজের অনুপাত', 'Proportion of total work completed')}
                </p>
              </div>
              <span className="badge badge-gray shrink-0 tabular-nums">
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

          <div className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">
                  {L('কর্মীদের সার্বিক অবদানের ভাগ', "Employees' Overall Contribution")}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {L('মোট স্কোরে কোন কর্মীর কতটুকু অবদান', "Each employee's share of overall score")}
                </p>
              </div>
              <span className="badge badge-gray shrink-0 tabular-nums">
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

      {/* 2. Per-metric view */}
      {viewCategory === 'BY_METRIC' && (
        <div className="space-y-4">
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
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMetric(item.key)}
                  className={chipClass(isSelected)}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: isSelected ? 'currentColor' : METRIC_COLORS[item.key] }} />
                  <span>{item.label}</span>
                  <span className={chipCountClass(isSelected)}>
                    {typeof item.count === 'number' ? formatNum(item.count) : item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <MetricIcon className="h-4 w-4" style={{ color: METRIC_COLORS[selectedMetric] }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {L(currentMetricCfg.titleBn, currentMetricCfg.titleEn)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {L('এই কাজে কর্মীদের অবদান ও অর্জনের ৩ডি অনুপাত', "Employees' 3D distribution for this specific task")}
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs text-slate-500">{L('সর্বমোট অর্জিত', 'Total Achieved')}</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">
                  {selectedMetric === 'SALES' ? formatMoney(totals.sales) : `${formatNum(currentMetricCfg.total)} ${currentMetricCfg.unit}`}
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

      {/* 3. Per-employee view */}
      {viewCategory === 'BY_EMPLOYEE' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {employees.map((emp, index) => {
              const isSelected = selectedEmployeeId === emp.id;
              const color = EMPLOYEE_PALETTE[index % EMPLOYEE_PALETTE.length];
              return (
                <button
                  key={emp.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className={chipClass(isSelected)}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span>{emp.name}</span>
                  <span className={chipCountClass(isSelected)}>{formatNum(emp.targetProgressPercent)}%</span>
                </button>
              );
            })}
          </div>

          {activeEmployee ? (
            <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {activeEmployee.name} - {L('কাজের ব্যক্তিগত ৩ডি বিভাজন', 'Personal Work 3D Distribution')}
                    </h3>
                    <p className="truncate text-xs text-slate-500">{activeEmployee.email}</p>
                  </div>
                  <span className="badge badge-brand shrink-0 tabular-nums">
                    {L('অগ্রগতি', 'Progress')}: {formatNum(activeEmployee.targetProgressPercent)}%
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

              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                {(
                  [
                    { label: L('মোট পোস্ট', 'Total Posts'), value: formatNum(activeEmployee.metrics.posts_done), unit: L('টি', ''), color: METRIC_COLORS.POSTS },
                    { label: L('নিশ্চিত অর্ডার', 'Confirmed Orders'), value: formatNum(activeEmployee.metrics.orders_confirmed), unit: L('টি', ''), color: METRIC_COLORS.ORDERS },
                    { label: L('মেসেজ রিপ্লাই', 'Messages Replied'), value: formatNum(activeEmployee.metrics.messages_replied), unit: L('টি', ''), color: METRIC_COLORS.MESSAGES },
                    { label: L('লিড সংগ্রহ', 'Leads Collected'), value: formatNum(activeEmployee.metrics.leads_collected), unit: L('জন', ''), color: METRIC_COLORS.LEADS },
                    { label: L('মোট বিক্রয়', 'Sales Amount'), value: formatMoney(activeEmployee.metrics.sales_amount), unit: '', color: METRIC_COLORS.SALES },
                  ]
                ).map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 px-4 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stat.color }} />
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                      {stat.value} {stat.unit && <span className="text-xs font-normal text-slate-500">{stat.unit}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title={L('কোনো কর্মী পাওয়া যায়নি', 'No employee found')}
            />
          )}
        </div>
      )}
      </div>
    </section>
  );
}
