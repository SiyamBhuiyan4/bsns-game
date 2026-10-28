'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  History,
  Calendar,
  Share2,
  ShoppingCart,
  MessageSquare,
  UserPlus,
  DollarSign,
  ArrowUpDown,
  LayoutGrid,
  List,
  ChevronRight,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { EmployeeWorkSummaryItem } from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';
import EmployeeHistoryModal from './EmployeeHistoryModal';
import EmptyState from '@/components/ui/EmptyState';
import PerformancePieCharts from './PerformancePieCharts';
import Avatar from '@/components/ui/Avatar';

export interface EmployeePerformanceOverviewProps {
  employees: EmployeeWorkSummaryItem[];
  periodLabel?: string;
}

type SortField =
  | 'name'
  | 'posts_done'
  | 'orders_confirmed'
  | 'messages_replied'
  | 'leads_collected'
  | 'sales_amount'
  | 'targetProgressPercent';

export default function EmployeePerformanceOverview({
  employees = [],
  periodLabel,
}: EmployeePerformanceOverviewProps) {
  const { lang, formatMoney, formatNum } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('targetProgressPercent');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'pie'>('table');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWorkSummaryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Top summary totals across all employees
  const totals = useMemo(() => {
    return employees.reduce(
      (acc, emp) => {
        acc.posts_done += emp.metrics.posts_done || 0;
        acc.orders_confirmed += emp.metrics.orders_confirmed || 0;
        acc.messages_replied += emp.metrics.messages_replied || 0;
        acc.leads_collected += emp.metrics.leads_collected || 0;
        acc.sales_amount += emp.metrics.sales_amount || 0;
        return acc;
      },
      {
        posts_done: 0,
        orders_confirmed: 0,
        messages_replied: 0,
        leads_collected: 0,
        sales_amount: 0,
      }
    );
  }, [employees]);

  // Filter & Sort
  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        return sortAsc
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      } else if (sortField === 'targetProgressPercent') {
        valA = a.targetProgressPercent || 0;
        valB = b.targetProgressPercent || 0;
      } else {
        valA = a.metrics[sortField] || 0;
        valB = b.metrics[sortField] || 0;
      }

      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return result;
  }, [employees, searchTerm, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleOpenHistory = (emp: EmployeeWorkSummaryItem) => {
    setSelectedEmployee(emp);
    setIsModalOpen(true);
  };

  const progressBarColor = (progress: number) =>
    progress >= 80
      ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
      : progress >= 50
        ? 'bg-gradient-to-r from-sky-400 to-indigo-500'
        : 'bg-gradient-to-r from-amber-400 to-rose-500';

  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  const viewModes: { key: 'table' | 'cards' | 'pie'; icon: React.ReactNode; label: string; title: string }[] = [
    { key: 'table', icon: <List className="h-3.5 w-3.5" />, label: L('তালিকা', 'Table'), title: L('টেবিল ভিউ', 'Table View') },
    { key: 'cards', icon: <LayoutGrid className="h-3.5 w-3.5" />, label: L('কার্ড', 'Cards'), title: L('কার্ড ভিউ', 'Cards View') },
    { key: 'pie', icon: <PieChartIcon className="h-3.5 w-3.5" />, label: L('৩ডি পাই', '3D Pie'), title: L('৩ডি পাই চার্ট', '3D Pie Chart') },
  ];

  const summary: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [
    {
      label: L('সক্রিয় কর্মী', 'Active Employees'),
      icon: <Users className="h-3.5 w-3.5" />,
      value: (
        <>
          {formatNum(employees.length)} <span className="text-xs font-normal text-slate-500">{L('জন', '')}</span>
        </>
      ),
    },
    { label: L('মোট গ্রুপ পোস্ট', 'Total Posts'), icon: <Share2 className="h-3.5 w-3.5" />, value: formatNum(totals.posts_done) },
    { label: L('নিশ্চিত অর্ডার', 'Confirmed Orders'), icon: <ShoppingCart className="h-3.5 w-3.5" />, value: formatNum(totals.orders_confirmed) },
    { label: L('মেসেজ রিপ্লাই', 'Messages'), icon: <MessageSquare className="h-3.5 w-3.5" />, value: formatNum(totals.messages_replied) },
    { label: L('লিড সংগ্রহ', 'Leads'), icon: <UserPlus className="h-3.5 w-3.5" />, value: formatNum(totals.leads_collected) },
    { label: L('মোট বিক্রয়', 'Total Sales'), icon: <DollarSign className="h-3.5 w-3.5" />, value: formatMoney(totals.sales_amount) },
  ];

  const sortableColumns: { field: SortField; label: string; align: 'left' | 'right' }[] = [
    { field: 'name', label: L('কর্মী', 'Employee'), align: 'left' },
    { field: 'posts_done', label: L('গ্রুপ পোস্ট', 'Posts'), align: 'right' },
    { field: 'orders_confirmed', label: L('নিশ্চিত অর্ডার', 'Orders'), align: 'right' },
    { field: 'messages_replied', label: L('মেসেজ', 'Messages'), align: 'right' },
    { field: 'leads_collected', label: L('লিড', 'Leads'), align: 'right' },
    { field: 'sales_amount', label: L('বিক্রয় (৳)', 'Sales (৳)'), align: 'right' },
    { field: 'targetProgressPercent', label: L('লক্ষ্য অগ্রগতি', 'Target %'), align: 'left' },
  ];

  // Each metric keeps its own colour across the table, so a column reads at a glance.
  const numCell = (value: number, tone: string) =>
    value > 0 ? (
      <span className={`inline-flex min-w-8 justify-end rounded-lg px-2 py-0.5 font-semibold ${tone}`}>{formatNum(value)}</span>
    ) : (
      <span className="text-slate-400">{formatNum(value)}</span>
    );

  return (
    <section className="space-y-4">
      {/* Overview header & team totals */}
      <div className="card">
        <div className="card-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/10">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">
                {L('কর্মীদের কাজের পরিসংখ্যান ও পারফরম্যান্স', 'Employee Performance & Work Stats')}
              </h2>
              <p className="card-subtitle mt-0.5">
                {L(
                  'প্রতিটি কর্মীর দৈনিক কাজ, বিক্রয়, লিড ও পূর্ণ তারিখভিত্তিক কাজের ইতিহাস',
                  'Real-time overview of tasks, confirmed orders, leads and full date-by-date history'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {periodLabel && (
              <span className="badge badge-gray py-1">
                <Calendar className="h-3 w-3" />
                {periodLabel}
              </span>
            )}
            <div className="segmented" role="group">
              {viewModes.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setViewMode(m.key)}
                  data-active={viewMode === m.key}
                  aria-pressed={viewMode === m.key}
                  aria-label={m.title}
                  title={m.title}
                  className="inline-flex items-center gap-1.5"
                >
                  {m.icon}
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-2xl bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
          {summary.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 bg-white px-5 py-4">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-slate-400">{item.icon}</span>
                {item.label}
              </dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Filter / search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label={L('কর্মীর নাম বা ইমেইল দিয়ে খুঁজুন...', 'Search by employee name or email...')}
            placeholder={L('কর্মীর নাম বা ইমেইল দিয়ে খুঁজুন...', 'Search by employee name or email...')}
            className="input pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="whitespace-nowrap">{L('সাজান:', 'Sort by:')}</span>
          <select
            aria-label={L('সাজান:', 'Sort by:')}
            className="input input-sm w-auto"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
          >
            <option value="targetProgressPercent">{L('অগ্রগতি (%)', 'Target Progress (%)')}</option>
            <option value="posts_done">{L('গ্রুপ পোস্ট', 'Posts Done')}</option>
            <option value="orders_confirmed">{L('নিশ্চিত অর্ডার', 'Confirmed Orders')}</option>
            <option value="messages_replied">{L('মেসেজ রিপ্লাই', 'Messages Replied')}</option>
            <option value="leads_collected">{L('লিড সংগ্রহ', 'Leads Collected')}</option>
            <option value="sales_amount">{L('বিক্রয় (৳)', 'Sales Amount (৳)')}</option>
            <option value="name">{L('নাম (A-Z)', 'Name')}</option>
          </select>
          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="btn btn-secondary btn-sm px-2"
            title={sortAsc ? L('ছোট থেকে বড়', 'Ascending') : L('বড় থেকে ছোট', 'Descending')}
            aria-label={sortAsc ? L('ছোট থেকে বড়', 'Ascending') : L('বড় থেকে ছোট', 'Descending')}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main content: table, cards or pie */}
      {filteredEmployees.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={L('কোনো কর্মী পাওয়া যায়নি', 'No employees found')}
            description={
              searchTerm
                ? L('অনুসন্ধানের সাথে কোনো কর্মীর মিল নেই। সার্চ ফিল্টার সাফ করুন।', 'No employee matched your search query.')
                : L('বর্তমানে কোনো সক্রিয় কর্মী নেই।', 'No active employees recorded in the system.')
            }
          />
        </div>
      ) : viewMode === 'table' ? (
        <div className="card overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="table-pro">
              <thead className="sticky top-0 z-10">
                <tr>
                  {sortableColumns.map((col) => {
                    const active = sortField === col.field;
                    return (
                      <th
                        key={col.field}
                        scope="col"
                        aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                        className={`whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''} ${
                          col.field === 'targetProgressPercent' ? 'min-w-[150px]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(col.field)}
                          className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-slate-900 ${
                            active ? 'text-slate-900' : ''
                          }`}
                        >
                          <span>{col.label}</span>
                          <ArrowUpDown className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="text-right">
                    <span className="sr-only">{L('কাজের ইতিহাস', 'Work History')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => {
                  const progress = Math.max(0, emp.targetProgressPercent || 0);

                  return (
                    <tr
                      key={emp.id}
                      className="group cursor-pointer"
                      onClick={() => handleOpenHistory(emp)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.name} size={32} animated={false} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">{emp.name}</div>
                            <div className="max-w-[200px] truncate text-xs text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right tabular-nums">{numCell(emp.metrics.posts_done, 'bg-violet-50 text-violet-700')}</td>
                      <td className="text-right tabular-nums">{numCell(emp.metrics.orders_confirmed, 'bg-emerald-50 text-emerald-700')}</td>
                      <td className="text-right tabular-nums">{numCell(emp.metrics.messages_replied, 'bg-sky-50 text-sky-700')}</td>
                      <td className="text-right tabular-nums">{numCell(emp.metrics.leads_collected, 'bg-amber-50 text-amber-700')}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        <span className={emp.metrics.sales_amount > 0 ? 'rounded-lg bg-rose-50 px-2 py-0.5 font-semibold text-rose-700' : 'text-slate-400'}>
                          {formatMoney(emp.metrics.sales_amount)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="h-2 w-full min-w-[72px] overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-2 rounded-full ${progressBarColor(progress)} transition-all duration-500`}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-700 tabular-nums">
                            {formatNum(emp.targetProgressPercent)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenHistory(emp);
                          }}
                          className="btn btn-ghost btn-sm"
                          aria-label={`${L('পূর্ণ ইতিহাস', 'Full History')}: ${emp.name}`}
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>{L('পূর্ণ ইতিহাস', 'Full History')}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 tabular-nums">
                            {formatNum(emp.history.length)}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'pie' ? (
        <PerformancePieCharts employees={employees} />
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((emp) => {
            const progress = Math.max(0, emp.targetProgressPercent || 0);
            const metricRows: { label: string; icon: React.ReactNode; value: React.ReactNode }[] = [
              { label: L('গ্রুপ পোস্ট', 'Posts'), icon: <Share2 className="h-3.5 w-3.5" />, value: formatNum(emp.metrics.posts_done) },
              { label: L('অর্ডার', 'Orders'), icon: <ShoppingCart className="h-3.5 w-3.5" />, value: formatNum(emp.metrics.orders_confirmed) },
              { label: L('মেসেজ', 'Messages'), icon: <MessageSquare className="h-3.5 w-3.5" />, value: formatNum(emp.metrics.messages_replied) },
              { label: L('লিড', 'Leads'), icon: <UserPlus className="h-3.5 w-3.5" />, value: formatNum(emp.metrics.leads_collected) },
            ];

            return (
              <div
                key={emp.id}
                role="button"
                tabIndex={0}
                className="card group flex cursor-pointer flex-col justify-between p-5"
                onClick={() => handleOpenHistory(emp)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenHistory(emp);
                  }
                }}
              >
                <div>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={emp.name} size={36} animated={false} />
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-semibold text-slate-900">{emp.name}</h4>
                        <p className="truncate text-xs text-slate-500">{emp.email}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatNum(emp.targetProgressPercent)}%
                    </span>
                  </div>

                  <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${progressBarColor(progress)} transition-all duration-500`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>

                  <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
                    {metricRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-3 py-2">
                        <dt className="flex items-center gap-1.5 text-slate-500">
                          <span className="text-slate-400">{row.icon}</span>
                          {row.label}
                        </dt>
                        <dd className="font-medium text-slate-900 tabular-nums">{row.value}</dd>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-slate-500">
                        <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                        {L('মোট বিক্রয়', 'Total Sales')}
                      </dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">{formatMoney(emp.metrics.sales_amount)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span className="tabular-nums">{formatNum(emp.history.length)}</span> {L('দিনের এন্ট্রি', 'days logged')}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenHistory(emp);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors group-hover:text-brand-700 hover:text-brand-700"
                  >
                    <span>{L('পূর্ণ ইতিহাস দেখুন', 'View Full History')}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Date-by-date Full Work History Modal */}
      <EmployeeHistoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmployee}
        periodLabel={periodLabel}
        allEmployees={employees}
        onSelectEmployee={(emp) => setSelectedEmployee(emp)}
      />
    </section>
  );
}
