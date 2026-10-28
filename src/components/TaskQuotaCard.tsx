'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Coffee, Flame } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

interface Status {
  quotaId: string;
  sectionName: string | null;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  amount: number;
  isOffDay: boolean;
  mandatory: number;
  mandatoryLeft: number;
  normal: number;
  normalLeft: number;
  doneToday: number;
  remaining: number;
  windowEnd: string;
  workingDaysLeft: number;
  isLastWorkingDay: boolean;
}

/** Today's mandatory and optional tasks, from the quotas an admin assigned. Renders nothing without one. */
export default function TaskQuotaCard() {
  const { L } = useLanguage();
  const [quotas, setQuotas] = useState<Status[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/employee/task-quota', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { quotas: [] }))
      .then((d) => setQuotas(d.quotas ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);

  if (quotas === null) {
    return (
      <div role="status" aria-busy="true" className="card overflow-hidden">
        <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div aria-hidden className="skeleton h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <div aria-hidden className="skeleton h-4 w-32" />
            <div aria-hidden className="skeleton h-3 w-44" />
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2.5 rounded-xl border border-slate-100 p-4">
              <div aria-hidden className="skeleton h-3 w-24" />
              <div aria-hidden className="skeleton h-7 w-16" />
              <div aria-hidden className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (quotas.length === 0) return null;

  const periodLabel = (p: Status['period']) =>
    p === 'DAILY' ? L('দৈনিক', 'Daily') : p === 'WEEKLY' ? L('সাপ্তাহিক', 'Weekly') : L('মাসিক', 'Monthly');

  return (
    <div className={`stagger grid gap-4 ${quotas.length > 1 ? 'lg:grid-cols-2' : ''}`}>
      {quotas.map((q) => {
        const mandatoryDone = q.mandatory - q.mandatoryLeft;
        const pct = q.mandatory > 0 ? Math.min(100, Math.round((mandatoryDone / q.mandatory) * 100)) : 100;
        const normalDone = q.normal - q.normalLeft;
        const normalPct = q.normal > 0 ? Math.min(100, Math.round((normalDone / q.normal) * 100)) : 0;
        const mandatoryComplete = q.mandatoryLeft === 0;
        return (
          <section key={q.quotaId} className="card relative overflow-hidden">
            {/* Thin colour rail: violet while work is open, green once the mandatory part is done. */}
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                mandatoryComplete ? 'from-emerald-500 to-brand-400' : 'from-violet-500 to-sky-500'
              }`}
            />
            <div className="card-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="card-title">{L('আজকের কাজ', "Today's tasks")}</h2>
                  <p className="card-subtitle truncate">
                    {periodLabel(q.period)} <span className="tabular-nums">{q.amount}</span> ·{' '}
                    {q.sectionName ?? L('সব সেকশন', 'All sections')}
                  </p>
                </div>
              </div>
              {q.isLastWorkingDay && !q.isOffDay && (
                <span className="badge badge-amber">
                  <Flame className="h-3 w-3" /> {L('কোটা পূরণের শেষ দিন', 'Last day to close the quota')}
                </span>
              )}
            </div>

            <div className="card-body">
              {q.isOffDay ? (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50/60 p-4 text-sm text-slate-700">
                  <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    {L('আজ আপনার ছুটির দিন। চাইলে বাকি কাজ এগিয়ে রাখতে পারেন।', 'Today is your off day. You can still get ahead on the remaining work.')}
                  </span>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Mandatory */}
                  <div
                    className={`rounded-xl border p-4 ${
                      mandatoryComplete ? 'border-emerald-200 bg-emerald-50/50' : 'border-violet-200 bg-violet-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">{L('বাধ্যতামূলক', 'Mandatory')}</span>
                      {mandatoryComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="text-xs font-medium text-violet-700 tabular-nums">
                          {q.mandatoryLeft} {L('বাকি', 'left')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {mandatoryDone}
                      <span className="text-base font-normal text-slate-400">/{q.mandatory}</span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-white/80"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      aria-label={L('বাধ্যতামূলক', 'Mandatory')}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          mandatoryComplete ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {mandatoryComplete && (
                      <p className="mt-2 text-xs font-medium text-emerald-700">
                        {L('আজকের বাধ্যতামূলক কাজ শেষ', "Today's mandatory work is done")}
                      </p>
                    )}
                  </div>

                  {/* Optional */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">{L('সাধারণ (ঐচ্ছিক)', 'Normal (optional)')}</span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {q.normalLeft} {L('বাকি', 'left')}
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {normalDone}
                      <span className="text-base font-normal text-slate-400">/{q.normal}</span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={normalPct}
                      aria-label={L('সাধারণ (ঐচ্ছিক)', 'Normal (optional)')}
                    >
                      <div className="h-full rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${normalPct}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
              {L(
                `${q.windowEnd} এর মধ্যে বাকি ${q.remaining}টি · ${q.workingDaysLeft} কাজের দিন বাকি। সাধারণ কাজ না করলে শেষ দিনে সব বাধ্যতামূলক হবে।`,
                `${q.remaining} left by ${q.windowEnd} · ${q.workingDaysLeft} working days to go. Normal tasks you skip become mandatory on the last day.`
              )}
            </p>
          </section>
        );
      })}
    </div>
  );
}
