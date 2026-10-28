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

  const stats: { label: string; icon: React.ReactNode; value: React.ReactNode; note?: string }[] = [
    { label: L('গ্রুপ পোস্ট', 'Posts Done'), icon: <Share2 className="h-3.5 w-3.5" />, value: formatNum(employee.metrics.posts_done), note: L('সম্পন্ন পোস্ট', 'Finished') },
    { label: L('নিশ্চিত অর্ডার', 'Confirmed Orders'), icon: <ShoppingCart className="h-3.5 w-3.5" />, value: formatNum(employee.metrics.orders_confirmed), note: L('কনফার্মড অর্ডার', 'Confirmed') },
    { label: L('মেসেজ রিপ্লাই', 'Messages'), icon: <MessageSquare className="h-3.5 w-3.5" />, value: formatNum(employee.metrics.messages_replied), note: L('গ্রাহক রিপ্লাই', 'Followups') },
    { label: L('লিড সংগ্রহ', 'Leads'), icon: <UserPlus className="h-3.5 w-3.5" />, value: formatNum(employee.metrics.leads_collected), note: L('নতুন লিড', 'New Leads') },
    { label: L('মোট বিক্রয়', 'Sales Amount'), icon: <DollarSign className="h-3.5 w-3.5" />, value: formatMoney(employee.metrics.sales_amount), note: L('মোট আয়', 'Revenue') },
  ];

  const numCell = (value: number) => (
    <span className={value > 0 ? 'text-slate-900' : 'text-slate-400'}>{formatNum(value)}</span>
  );

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-history-title"
    >
      <div
        className="modal-panel flex flex-col sm:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
              {employee.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="employee-history-title" className="truncate text-base font-semibold text-slate-900">
                  {employee.name}
                </h3>
                {allEmployees && allEmployees.length > 1 && onSelectEmployee && (
                  <div className="relative inline-block">
                    <select
                      aria-label={L('কর্মী', 'Employee')}
                      className="input input-sm cursor-pointer appearance-none py-1 pr-7"
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
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{employee.email}</span>
                {periodLabel && (
                  <span className="badge badge-gray">
                    <Calendar className="h-3 w-3" />
                    {periodLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label={L('বন্ধ করুন', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          {/* Key metrics */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((st) => (
              <div key={st.label} className="flex flex-col gap-1 bg-white px-4 py-3">
                <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="text-slate-400">{st.icon}</span>
                  {st.label}
                </dt>
                <dd className="text-lg font-semibold text-slate-900 tabular-nums">{st.value}</dd>
                {st.note && <span className="text-[11px] text-slate-400">{st.note}</span>}
              </div>
            ))}
            <div className="flex flex-col gap-1 bg-white px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                {L('লক্ষ্য অর্জন', 'Target Progress')}
              </dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums">
                {formatNum(employee.targetProgressPercent)}%
              </dd>
              <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, employee.targetProgressPercent))}%` }}
                />
              </div>
            </div>
          </dl>

          {/* History title + search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <h4 className="text-sm font-semibold text-slate-900">
                {L('দৈনিক কাজের পূর্ণ ইতিহাস (তারিখভিত্তিক)', 'Complete Daily Work History (Date-by-Date)')}
              </h4>
              <span className="badge badge-gray tabular-nums">
                {formatNum(employee.history.length)} {L('দিন', 'days')}
              </span>
            </div>

            {employee.history.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  aria-label={L('তারিখ বা নোট খুঁজুন...', 'Search date or note...')}
                  placeholder={L('তারিখ বা নোট খুঁজুন...', 'Search date or note...')}
                  className="input input-sm pl-8 pr-8"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    aria-label={L('মুছুন', 'Clear')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* History table */}
          {sortedAndFilteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200">
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
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
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
              <table className="table-pro">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="min-w-[130px]">{L('তারিখ', 'Date')}</th>
                    <th scope="col" className="text-right">{L('গ্রুপ পোস্ট', 'Posts')}</th>
                    <th scope="col" className="text-right">{L('নিশ্চিত অর্ডার', 'Orders')}</th>
                    <th scope="col" className="text-right">{L('মেসেজ', 'Messages')}</th>
                    <th scope="col" className="text-right">{L('লিড', 'Leads')}</th>
                    <th scope="col" className="text-right">{L('বিক্রয় (৳)', 'Sales (৳)')}</th>
                    <th scope="col" className="min-w-[200px]">{L('মন্তব্য / প্রধান ইস্যু', 'Notes / Issues')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredHistory.map((item, index) => {
                    const { dateStr, weekday } = formatHistoryDate(item.date);
                    return (
                      <tr key={item.date || index}>
                        <td className="whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 tabular-nums">{dateStr}</div>
                          {weekday && <div className="text-xs text-slate-500">{weekday}</div>}
                        </td>
                        <td className="text-right tabular-nums">{numCell(item.posts_done)}</td>
                        <td className="text-right tabular-nums">{numCell(item.orders_confirmed)}</td>
                        <td className="text-right tabular-nums">{numCell(item.messages_replied)}</td>
                        <td className="text-right tabular-nums">{numCell(item.leads_collected)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">
                          <span className={item.sales_amount > 0 ? 'font-medium text-slate-900' : 'text-slate-400'}>
                            {formatMoney(item.sales_amount)}
                          </span>
                        </td>
                        <td className="text-xs">
                          {item.note ? (
                            <div className="flex max-w-sm items-start gap-1.5">
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="line-clamp-2 text-slate-700" title={item.note}>
                                {item.note}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
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

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-6">
          <div className="text-xs text-slate-500">
            {L(
              `মোট ${employee.history.length} টি দৈনিক রেকর্ড সংরক্ষিত`,
              `Total ${employee.history.length} daily entries recorded`
            )}
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            {L('বন্ধ করুন', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
