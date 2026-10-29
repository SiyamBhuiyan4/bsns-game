'use client';

import React, { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import { DashboardPeriodKey } from '@/lib/dashboard';
import { useLanguage } from '@/components/LanguageContext';

interface Props {
  currentPeriod: DashboardPeriodKey;
  currentFrom?: string;
  currentTo?: string;
}

interface PeriodOption {
  key: DashboardPeriodKey;
  labelBn: string;
  labelEn: string;
}



export default function DashboardPeriodSelector({
  currentPeriod,
  currentFrom,
  currentTo,
}: Props) {
  const router = useRouter();
  // Stay on whichever dashboard rendered this (admin or employee).
  const pathname = usePathname() || '/admin/dashboard';
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const go = (url: string) => startTransition(() => router.push(url));
  const { L } = useLanguage();
  const PERIOD_OPTIONS: PeriodOption[] = [
    { key: 'today', labelBn: L('আজ'), labelEn: 'Today' },
    { key: 'yesterday', labelBn: L('গতকাল'), labelEn: 'Yesterday' },
    { key: 'last7days', labelBn: L('গত ৭ দিন'), labelEn: 'Last 7 Days' },
    { key: 'thisMonth', labelBn: L('এই মাস'), labelEn: 'This Month' },
    { key: 'custom', labelBn: L('কাস্টম'), labelEn: 'Custom' },
  ];

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
    go(`${pathname}?${params.toString()}`);
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
    go(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      className="card flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      aria-busy={isPending}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <span className="icon-tile icon-tile-sky h-8 w-8 rounded-lg">
          <Calendar className="h-4 w-4" />
        </span>
        <span>{L('সময়কাল', 'Time Period')}</span>
        {isPending && (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
            {L('লোড হচ্ছে...', 'Loading...')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="segmented max-w-full flex-wrap" role="group" aria-label={L('সময়কাল', 'Time Period')}>
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
                {L(opt.labelBn, opt.labelEn)}
              </button>
            );
          })}
        </div>

        {isCustomOpen && (
          <form onSubmit={handleCustomApply} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
            <input
              type="date"
              aria-label={L('শুরুর তারিখ', 'Start Date')}
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="input min-h-10 w-full py-1.5 text-sm sm:min-h-0 sm:w-auto sm:text-xs"
              required
            />
            <span className="text-xs text-slate-400">{L('থেকে', 'to')}</span>
            <input
              type="date"
              aria-label={L('শেষ তারিখ', 'End Date')}
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="input min-h-10 w-full py-1.5 text-sm sm:min-h-0 sm:w-auto sm:text-xs"
              required
            />
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm col-span-3 min-h-10 sm:min-h-0">
              {L('দেখুন', 'Apply')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
