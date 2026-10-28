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

  if (quotas === null) return <div className="skeleton h-28" />;
  if (quotas.length === 0) return null;

  const periodLabel = (p: Status['period']) =>
    p === 'DAILY' ? L('দৈনিক', 'Daily') : p === 'WEEKLY' ? L('সাপ্তাহিক', 'Weekly') : L('মাসিক', 'Monthly');

  return (
    <div className="stagger grid gap-4 md:grid-cols-2">
      {quotas.map((q) => {
        const mandatoryDone = q.mandatory - q.mandatoryLeft;
        const pct = q.mandatory > 0 ? Math.min(100, Math.round((mandatoryDone / q.mandatory) * 100)) : 100;
        return (
          <div key={q.quotaId} className="card hover-lift overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <div className="card-title">{L('আজকের কাজ', "Today's tasks")}</div>
                  <div className="card-subtitle">
                    {periodLabel(q.period)} {q.amount} · {q.sectionName ?? L('সব সেকশন', 'All sections')}
                  </div>
                </div>
              </div>
              {q.isLastWorkingDay && !q.isOffDay && (
                <span className="badge badge-amber">
                  <Flame className="h-3 w-3" /> {L('কোটা পূরণের শেষ দিন', 'Last day to close the quota')}
                </span>
              )}
            </div>
            <div className="card-body space-y-4">
              {q.isOffDay ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Coffee className="h-4 w-4 text-amber-500" />
                  {L('আজ আপনার ছুটির দিন। চাইলে বাকি কাজ এগিয়ে রাখতে পারেন।', 'Today is your off day. You can still get ahead on the remaining work.')}
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-900">{L('বাধ্যতামূলক', 'Mandatory')}</span>
                      <span className="tabular-nums text-slate-600">
                        {mandatoryDone}/{q.mandatory}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${q.mandatoryLeft === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {q.mandatoryLeft === 0 && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {L('আজকের বাধ্যতামূলক কাজ শেষ', "Today's mandatory work is done")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{L('সাধারণ (ঐচ্ছিক)', 'Normal (optional)')}</span>
                    <span className="tabular-nums text-slate-600">
                      {q.normal - q.normalLeft}/{q.normal}
                    </span>
                  </div>
                </>
              )}
              <p className="text-xs text-slate-500">
                {L(
                  `${q.windowEnd} এর মধ্যে বাকি ${q.remaining}টি · ${q.workingDaysLeft} কাজের দিন বাকি। সাধারণ কাজ না করলে শেষ দিনে সব বাধ্যতামূলক হবে।`,
                  `${q.remaining} left by ${q.windowEnd} · ${q.workingDaysLeft} working days to go. Normal tasks you skip become mandatory on the last day.`
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
