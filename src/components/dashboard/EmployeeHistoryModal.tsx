'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  History,
  Share2,
  ShoppingCart,
  MessageSquare,
  UserPlus,
  DollarSign,
  TrendingUp,
  FileText,
  Search,
  ChevronDown,
  CalendarDays,
} from 'lucide-react';
import { EmployeeWorkSummaryItem } from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';

export interface EmployeeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeWorkSummaryItem | null;
  periodLabel?: string;
  allEmployees?: EmployeeWorkSummaryItem[];
  onSelectEmployee?: (employee: EmployeeWorkSummaryItem) => void;
}

export default function EmployeeHistoryModal({
  isOpen,
  onClose,
  employee,
  periodLabel,
  allEmployees,
  onSelectEmployee,
}: EmployeeHistoryModalProps) {
  const { lang, formatMoney, formatNum, L } = useLanguage();
  const [historySearch, setHistorySearch] = useState('');


  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when employee changes
  useEffect(() => {
    setHistorySearch('');
  }, [employee?.id]);

  const sortedAndFilteredHistory = useMemo(() => {
    if (!employee || !employee.history) return [];
    let list = [...employee.history].sort((a, b) => b.date.localeCompare(a.date));

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.date.includes(q) ||
          (item.note && item.note.toLowerCase().includes(q))
      );
    }
    return list;
  }, [employee, historySearch]);

  if (!isOpen || !employee) return null;

  // Format date readable with weekday in bn/en
  const formatHistoryDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          const weekdayEn = d.toLocaleDateString('en-US', { weekday: 'short' });
          const weekdayBnMap: Record<string, string> = {
            Sun: L('রবি'),
            Mon: L('সোম'),
            Tue: L('মঙ্গল'),
            Wed: L('বুধ'),
            Thu: L('বৃহঃ'),
            Fri: L('শুক্র'),
            Sat: L('শনি'),
          };
          const weekday = lang === 'bn' ? (weekdayBnMap[weekdayEn] || weekdayEn) : weekdayEn;
          return {
            dateStr,
            weekday,
          };
        }
      }
    } catch {
      // fallback
    }
    return { dateStr, weekday: '' };
  };

  // Generate an avatar background gradient based on employee name
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarGradient(
                employee.name
              )} text-lg font-bold text-white shadow-sm ring-2 ring-white`}
            >
              {employee.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{employee.name}</h3>
                {allEmployees && allEmployees.length > 1 && onSelectEmployee && (
                  <div className="relative inline-block">
                    <select
                      className="text-xs bg-slate-100 border-0 rounded-md py-1 pl-2 pr-6 text-slate-600 font-medium cursor-pointer hover:bg-slate-200 focus:ring-1 focus:ring-brand-500 appearance-none"
                      value={employee.id}
                      onChange={(e) => {
                        const found = allEmployees.find((emp) => emp.id === e.target.value);
                        if (found) onSelectEmployee(found);
                      }}
                    >
                      {allEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 top-2 pointer-events-none" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>{employee.email}</span>
                {periodLabel && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 font-medium text-slate-700">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {periodLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Summary Cards for Employee */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-sky-700 mb-1">
                <span className="text-xs font-medium">{L('গ্রুপ পোস্ট', 'Posts Done')}</span>
                <Share2 className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-sky-900 tabular-nums">
                {formatNum(employee.metrics.posts_done)}
              </div>
              <span className="text-[10px] text-sky-600 mt-auto">{L('সম্পন্ন পোস্ট', 'Finished')}</span>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-xs font-medium">{L('নিশ্চিত অর্ডার', 'Confirmed Orders')}</span>
                <ShoppingCart className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-emerald-900 tabular-nums">
                {formatNum(employee.metrics.orders_confirmed)}
              </div>
              <span className="text-[10px] text-emerald-600 mt-auto">{L('কনফার্মড অর্ডার', 'Confirmed')}</span>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-indigo-700 mb-1">
                <span className="text-xs font-medium">{L('মেসেজ রিপ্লাই', 'Messages')}</span>
                <MessageSquare className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-indigo-900 tabular-nums">
                {formatNum(employee.metrics.messages_replied)}
              </div>
              <span className="text-[10px] text-indigo-600 mt-auto">{L('গ্রাহক রিপ্লাই', 'Followups')}</span>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-medium">{L('লিড সংগ্রহ', 'Leads')}</span>
                <UserPlus className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-amber-900 tabular-nums">
                {formatNum(employee.metrics.leads_collected)}
              </div>
              <span className="text-[10px] text-amber-600 mt-auto">{L('নতুন লিড', 'New Leads')}</span>
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-teal-700 mb-1">
                <span className="text-xs font-medium">{L('মোট বিক্রয়', 'Sales Amount')}</span>
                <DollarSign className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-teal-900 tabular-nums">
                {formatMoney(employee.metrics.sales_amount)}
              </div>
              <span className="text-[10px] text-teal-600 mt-auto">{L('মোট আয়', 'Revenue')}</span>
            </div>

            <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 flex flex-col">
              <div className="flex items-center justify-between text-purple-700 mb-1">
                <span className="text-xs font-medium">{L('লক্ষ্য অর্জন', 'Target Progress')}</span>
                <TrendingUp className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-xl font-bold text-purple-900 tabular-nums">
                {formatNum(employee.targetProgressPercent)}%
              </div>
              <div className="w-full bg-purple-200 rounded-full h-1.5 mt-auto overflow-hidden">
                <div
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, employee.targetProgressPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Table Header / Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-brand-600" />
              <h4 className="text-sm font-semibold text-slate-900">
                {L('দৈনিক কাজের পূর্ণ ইতিহাস (তারিখভিত্তিক)', 'Complete Daily Work History (Date-by-Date)')}
              </h4>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {formatNum(employee.history.length)} {L('দিন', 'days')}
              </span>
            </div>

            {employee.history.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={L('তারিখ বা নোট খুঁজুন...', 'Search date or note...')}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                {historySearch && (
                  <button
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* History Records Table */}
          {sortedAndFilteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10">
              <EmptyState
                icon={<CalendarDays className="w-8 h-8 text-slate-400" />}
                title={L('এই সময়কালে কোনো কাজের এন্ট্রি নেই', 'No work activity in this period')}
                description={
                  historySearch
                    ? L('অনুসন্ধানের সাথে কোনো মিল পাওয়া যায়নি। ফিল্টারটি সাফ করুন।', 'No activity matched your search filter.')
                    : L(
                        'এই কর্মী উক্ত সময়কালে এখনো কোনো পোস্ট, অর্ডার বা দৈনিক এন্ট্রি জমা দেননি।',
                        'This employee has not recorded any posts, orders or daily entries in this period.'
                      )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3 min-w-[130px]">{L('তারিখ', 'Date')}</th>
                    <th className="px-3 py-3 text-center">{L('গ্রুপ পোস্ট', 'Posts')}</th>
                    <th className="px-3 py-3 text-center">{L('নিশ্চিত অর্ডার', 'Orders')}</th>
                    <th className="px-3 py-3 text-center">{L('মেসেজ', 'Messages')}</th>
                    <th className="px-3 py-3 text-center">{L('লিড', 'Leads')}</th>
                    <th className="px-3 py-3 text-right">{L('বিক্রয় (৳)', 'Sales (৳)')}</th>
                    <th className="px-4 py-3 min-w-[200px]">{L('মন্তব্য / প্রধান ইস্যু', 'Notes / Issues')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedAndFilteredHistory.map((item, index) => {
                    const { dateStr, weekday } = formatHistoryDate(item.date);
                    return (
                      <tr
                        key={item.date || index}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 font-mono text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800 tabular-nums">
                                {dateStr}
                              </div>
                              {weekday && (
                                <div className="text-[10px] text-slate-400 font-medium">
                                  {weekday}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Posts Done */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              item.posts_done > 0
                                ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatNum(item.posts_done)}
                          </span>
                        </td>

                        {/* Confirmed Orders */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              item.orders_confirmed > 0
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatNum(item.orders_confirmed)}
                          </span>
                        </td>

                        {/* Messages Replied */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              item.messages_replied > 0
                                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatNum(item.messages_replied)}
                          </span>
                        </td>

                        {/* Leads Collected */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                              item.leads_collected > 0
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatNum(item.leads_collected)}
                          </span>
                        </td>

                        {/* Sales Amount */}
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`font-semibold text-xs tabular-nums ${
                              item.sales_amount > 0 ? 'text-teal-700 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {formatMoney(item.sales_amount)}
                          </span>
                        </td>

                        {/* Notes / Issues */}
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {item.note ? (
                            <div className="flex items-start gap-1.5 max-w-sm">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2 text-slate-700" title={item.note}>
                                {item.note}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <div className="text-xs text-slate-500">
            {L(
              `মোট ${employee.history.length} টি দৈনিক রেকর্ড সংরক্ষিত`,
              `Total ${employee.history.length} daily entries recorded`
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            {L('বন্ধ করুন', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
