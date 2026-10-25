'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';
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
  { key: 'custom', label: 'কাস্টম' },
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
    <div className="card flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Calendar className="h-4 w-4 text-slate-400" />
        <span>সময়কাল</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="segmented max-w-full flex-wrap" role="group" aria-label="সময়কাল">
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = isOptionActive(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={isActive}
                data-active={isActive ? 'true' : undefined}
                onClick={() => handlePeriodChange(opt.key)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {isCustomOpen && (
          <form onSubmit={handleCustomApply} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="শুরুর তারিখ"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="input w-auto py-1.5 text-xs"
              required
            />
            <span className="text-xs text-slate-400">থেকে</span>
            <input
              type="date"
              aria-label="শেষ তারিখ"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="input w-auto py-1.5 text-xs"
              required
            />
            <button type="submit" className="btn btn-primary btn-sm">
              দেখুন
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
