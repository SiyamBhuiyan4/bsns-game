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
} from 'lucide-react';
import { EmployeeWorkSummaryItem } from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';
import EmployeeHistoryModal from './EmployeeHistoryModal';
import EmptyState from '@/components/ui/EmptyState';

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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
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

  // Avatar color generator
  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-emerald-500 to-teal-600',
      'from-sky-500 to-blue-600',
      'from-indigo-500 to-purple-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return gradients[sum % gradients.length];
  };

  return (
    <div className="space-y-6">
      {/* Overview Header & Title */}
      <div className="card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {L('কর্মীদের কাজের পরিসংখ্যান ও পারফরম্যান্স', 'Employee Performance & Work Stats')}
                </h2>
                <p className="text-xs text-slate-500">
                  {L(
                    'প্রতিটি কর্মীর দৈনিক কাজ, বিক্রয়, লিড ও পূর্ণ তারিখভিত্তিক কাজের ইতিহাস',
                    'Real-time overview of tasks, confirmed orders, leads and full date-by-date history'
                  )}
                  {periodLabel && (
                    <span className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                      <Calendar className="w-3 h-3" />
                      {periodLabel}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Aggregate Badges / Controls */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* View Mode Switch */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title={L('টেবিল ভিউ', 'Table View')}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{L('তালিকা', 'Table')}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title={L('কার্ড ভিউ', 'Cards View')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{L('কার্ড', 'Cards')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Team Aggregate Summary Pills */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-100">
          <div className="flex flex-col p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
              {L('সক্রিয় কর্মী', 'Active Team')}
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatNum(employees.length)} <span className="text-xs font-normal text-slate-500">{L('জন', '')}</span>
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-lg bg-sky-50/50 border border-sky-100">
            <span className="text-[11px] font-medium text-sky-700 flex items-center justify-between">
              {L('মোট গ্রুপ পোস্ট', 'Total Posts')}
              <Share2 className="w-3.5 h-3.5 text-sky-500" />
            </span>
            <span className="text-xl font-bold text-sky-900 mt-1 tabular-nums">
              {formatNum(totals.posts_done)}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <span className="text-[11px] font-medium text-emerald-700 flex items-center justify-between">
              {L('নিশ্চিত অর্ডার', 'Confirmed Orders')}
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
            </span>
            <span className="text-xl font-bold text-emerald-900 mt-1 tabular-nums">
              {formatNum(totals.orders_confirmed)}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
            <span className="text-[11px] font-medium text-indigo-700 flex items-center justify-between">
              {L('মেসেজ রিপ্লাই', 'Messages')}
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            </span>
            <span className="text-xl font-bold text-indigo-900 mt-1 tabular-nums">
              {formatNum(totals.messages_replied)}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-lg bg-amber-50/50 border border-amber-100">
            <span className="text-[11px] font-medium text-amber-700 flex items-center justify-between">
              {L('লিড সংগ্রহ', 'Leads')}
              <UserPlus className="w-3.5 h-3.5 text-amber-500" />
            </span>
            <span className="text-xl font-bold text-amber-900 mt-1 tabular-nums">
              {formatNum(totals.leads_collected)}
            </span>
          </div>

          <div className="flex flex-col p-3 rounded-lg bg-teal-50/50 border border-teal-100">
            <span className="text-[11px] font-medium text-teal-700 flex items-center justify-between">
              {L('মোট বিক্রয়', 'Total Sales')}
              <DollarSign className="w-3.5 h-3.5 text-teal-500" />
            </span>
            <span className="text-xl font-bold text-teal-900 mt-1 tabular-nums">
              {formatMoney(totals.sales_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={L('কর্মীর নাম বা ইমেইল দিয়ে খুঁজুন...', 'Search by employee name or email...')}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{L('সাজান:', 'Sort by:')}</span>
          <select
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-xs"
            title={sortAsc ? L('ছোট থেকে বড়', 'Ascending') : L('বড় থেকে ছোট', 'Descending')}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Render Main Content: Table or Cards */}
      {filteredEmployees.length === 0 ? (
        <div className="card py-12">
          <EmptyState
            icon={<Users className="w-10 h-10 text-slate-400" />}
            title={L('কোনো কর্মী পাওয়া যায়নি', 'No employees found')}
            description={
              searchTerm
                ? L('অনুসন্ধানের সাথে কোনো কর্মীর মিল নেই। সার্চ ফিল্টার সাফ করুন।', 'No employee matched your search query.')
                : L('বর্তমানে কোনো সক্রিয় কর্মী নেই।', 'No active employees recorded in the system.')
            }
          />
        </div>
      ) : viewMode === 'table' ? (
        /* ============ Modern Responsive Table View ============ */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{L('কর্মী', 'Employee')}</span>
                      {sortField === 'name' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3.5 py-3.5 text-center cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('posts_done')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{L('গ্রুপ পোস্ট', 'Posts')}</span>
                      {sortField === 'posts_done' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3.5 py-3.5 text-center cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('orders_confirmed')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{L('নিশ্চিত অর্ডার', 'Orders')}</span>
                      {sortField === 'orders_confirmed' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3.5 py-3.5 text-center cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('messages_replied')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{L('মেসেজ', 'Messages')}</span>
                      {sortField === 'messages_replied' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3.5 py-3.5 text-center cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('leads_collected')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{L('লিড', 'Leads')}</span>
                      {sortField === 'leads_collected' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-3.5 py-3.5 text-right cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('sales_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>{L('বিক্রয় (৳)', 'Sales (৳)')}</span>
                      {sortField === 'sales_amount' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3.5 min-w-[150px] cursor-pointer hover:text-brand-700 transition-colors"
                    onClick={() => handleSort('targetProgressPercent')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{L('লক্ষ্য অগ্রগতি', 'Target %')}</span>
                      {sortField === 'targetProgressPercent' && (
                        <ArrowUpDown className="w-3 h-3 text-brand-600" />
                      )}
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-right min-w-[150px]">
                    {L('কাজের ইতিহাস', 'Work History')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredEmployees.map((emp) => {
                  const progress = Math.max(0, emp.targetProgressPercent || 0);
                  const progressColor =
                    progress >= 80
                      ? 'bg-emerald-500'
                      : progress >= 50
                      ? 'bg-sky-500'
                      : 'bg-amber-500';

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => handleOpenHistory(emp)}
                    >
                      {/* Employee Info */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarGradient(
                              emp.name
                            )} text-sm font-bold text-white shadow-xs`}
                          >
                            {emp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                              {emp.name}
                            </div>
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Posts Done */}
                      <td className="px-3.5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                            emp.metrics.posts_done > 0
                              ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatNum(emp.metrics.posts_done)}
                        </span>
                      </td>

                      {/* Orders Confirmed */}
                      <td className="px-3.5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                            emp.metrics.orders_confirmed > 0
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatNum(emp.metrics.orders_confirmed)}
                        </span>
                      </td>

                      {/* Messages Replied */}
                      <td className="px-3.5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                            emp.metrics.messages_replied > 0
                              ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatNum(emp.metrics.messages_replied)}
                        </span>
                      </td>

                      {/* Leads Collected */}
                      <td className="px-3.5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${
                            emp.metrics.leads_collected > 0
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatNum(emp.metrics.leads_collected)}
                        </span>
                      </td>

                      {/* Sales Amount */}
                      <td className="px-3.5 py-4 text-right">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            emp.metrics.sales_amount > 0 ? 'text-teal-700' : 'text-slate-400'
                          }`}
                        >
                          {formatMoney(emp.metrics.sales_amount)}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 tabular-nums">
                              {formatNum(emp.targetProgressPercent)}%
                            </span>
                            {progress >= 100 && (
                              <span className="text-[10px] font-bold text-emerald-600 uppercase">
                                {L('অর্জিত', 'Achieved')}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${progressColor} transition-all duration-300`}
                              style={{ width: `${Math.min(100, progress)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Work History Button */}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenHistory(emp);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-all cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-brand-600" />
                          <span>{L('পূর্ণ ইতিহাস', 'Full History')}</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-800">
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
      ) : (
        /* ============ Modern Card Grid View ============ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const progress = Math.max(0, emp.targetProgressPercent || 0);
            const progressColor =
              progress >= 80
                ? 'bg-emerald-500'
                : progress >= 50
                ? 'bg-sky-500'
                : 'bg-amber-500';

            return (
              <div
                key={emp.id}
                className="card p-5 hover:border-brand-500/50 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                onClick={() => handleOpenHistory(emp)}
              >
                <div>
                  {/* Card Header: Avatar & Info */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarGradient(
                          emp.name
                        )} text-sm font-bold text-white shadow-xs`}
                      >
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                          {emp.name}
                        </h4>
                        <p className="text-xs text-slate-400 truncate">{emp.email}</p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full tabular-nums">
                      {formatNum(emp.targetProgressPercent)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${progressColor} transition-all duration-300`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>

                  {/* 2x2 Metric Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-sky-50/60 border border-sky-100 p-2.5 flex items-center justify-between">
                      <div className="text-sky-700 flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{L('গ্রুপ পোস্ট', 'Posts')}</span>
                      </div>
                      <span className="font-bold text-sky-900 tabular-nums">
                        {formatNum(emp.metrics.posts_done)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 p-2.5 flex items-center justify-between">
                      <div className="text-emerald-700 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>{L('অর্ডার', 'Orders')}</span>
                      </div>
                      <span className="font-bold text-emerald-900 tabular-nums">
                        {formatNum(emp.metrics.orders_confirmed)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-2.5 flex items-center justify-between">
                      <div className="text-indigo-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{L('মেসেজ', 'Messages')}</span>
                      </div>
                      <span className="font-bold text-indigo-900 tabular-nums">
                        {formatNum(emp.metrics.messages_replied)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-amber-50/60 border border-amber-100 p-2.5 flex items-center justify-between">
                      <div className="text-amber-700 flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{L('লিড', 'Leads')}</span>
                      </div>
                      <span className="font-bold text-amber-900 tabular-nums">
                        {formatNum(emp.metrics.leads_collected)}
                      </span>
                    </div>
                  </div>

                  {/* Total Sales row */}
                  <div className="mt-2 rounded-lg bg-teal-50/60 border border-teal-100 p-2.5 flex items-center justify-between text-xs">
                    <div className="text-teal-700 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="font-medium">{L('মোট বিক্রয়', 'Total Sales')}</span>
                    </div>
                    <span className="font-bold text-teal-900 tabular-nums">
                      {formatMoney(emp.metrics.sales_amount)}
                    </span>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatNum(emp.history.length)} {L('দিনের এন্ট্রি', 'days logged')}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenHistory(emp);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    <span>{L('পূর্ণ ইতিহাস দেখুন', 'View Full History')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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
    </div>
  );
}
