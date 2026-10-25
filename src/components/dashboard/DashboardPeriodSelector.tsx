'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Check } from 'lucide-react';
import { DashboardPeriodKey } from '@/lib/dashboard';

interface Props {
  currentPeriod: DashboardPeriodKey;
  currentFrom?: string;
  currentTo?: string;
}

const PERIOD_OPTIONS: { key: DashboardPeriodKey; label: string }[] = [
  { key: 'today', label: 'আজ' },
  { key: 'yesterday', label: 'গতকাল' },
  { key: 'last7days', label: 'গত ৭ দিন' },
  { key: 'thisMonth', label: 'এই মাস' },
  { key: 'custom', label: 'কাস্টম রেঞ্জ' },
];

export default function DashboardPeriodSelector({
  currentPeriod,
  currentFrom,
  currentTo,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isCustomOpen, setIsCustomOpen] = useState(currentPeriod === 'custom');
  const [fromDate, setFromDate] = useState(currentFrom || '');
  const [toDate, setToDate] = useState(currentTo || '');

  const isOptionActive = (optKey: DashboardPeriodKey) => {
    if (currentPeriod === optKey) return true;
    if (
      (optKey === 'thisMonth' || optKey === 'month') &&
      (currentPeriod === 'thisMonth' || currentPeriod === 'month')
    ) {
      return true;
    }
    return false;
  };

  const handlePeriodChange = (period: DashboardPeriodKey) => {
    if (period === 'custom') {
      setIsCustomOpen(true);
      return;
    }

    setIsCustomOpen(false);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('period', period);
    params.delete('from');
    params.delete('to');
    router.push(`/admin/dashboard?${params.toString()}`);
  };

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return;

    let finalFrom = fromDate;
    let finalTo = toDate;
    if (finalFrom > finalTo) {
      const temp = finalFrom;
      finalFrom = finalTo;
      finalTo = temp;
      setFromDate(finalFrom);
      setToDate(finalTo);
    }

    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('period', 'custom');
    params.set('from', finalFrom);
    params.set('to', finalTo);
    router.push(`/admin/dashboard?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <Calendar className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-900">সময়কাল ফিল্টার (Period Selector)</div>
          <div className="text-[11px] text-slate-500">পারফরম্যান্স ও চার্ট ডাটা সময়সীমা অনুযায়ী প্রদর্শন</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = isOptionActive(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handlePeriodChange(opt.key)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {isActive && <Check className="h-3 w-3 text-emerald-600" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {isCustomOpen && (
          <form onSubmit={handleCustomApply} className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
            <span className="text-xs text-slate-400">হতে</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              প্রয়োগ করুন
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
