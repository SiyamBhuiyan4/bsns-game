'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import Avatar from '@/components/ui/Avatar';

export interface TodayStatus {
  targetId: string;
  employeeId: string;
  employeeName?: string;
  metricType: string;
  sectionName: string | null;
  amount: number;
  offDays: number[];
  rangeStart: string;
  rangeEnd: string;
  isOffDay: boolean;
  mandatory: number;
  mandatoryLeft: number;
  normal: number;
  normalLeft: number;
  doneBeforeToday: number;
  doneToday: number;
  remaining: number;
  windowEnd: string;
  isLastWorkingDay: boolean;
}

export const WEEKDAYS: { bn: string; en: string }[] = [
  { bn: 'রবি', en: 'Sun' },
  { bn: 'সোম', en: 'Mon' },
  { bn: 'মঙ্গল', en: 'Tue' },
  { bn: 'বুধ', en: 'Wed' },
  { bn: 'বৃহস্পতি', en: 'Thu' },
  { bn: 'শুক্র', en: 'Fri' },
  { bn: 'শনি', en: 'Sat' },
];

/** Admin view: what each running task asks of its employee today, split into mandatory and optional. */
export default function TargetTodayStatus({
  refreshKey,
  metricLabel,
}: {
  refreshKey: number;
  metricLabel: (metric: string) => string;
}) {
  const { L } = useLanguage();
  const [rows, setRows] = useState<TodayStatus[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/targets/today', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { statuses: [] }))
      .then((d) => setRows(d.statuses ?? []))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [refreshKey]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-md shadow-violet-500/30">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="card-title">{L('আজকের অবস্থা', "Today's status")}</h2>
            <p className="card-subtitle">
              {L(
                'প্রতিদিন বাধ্যতামূলক অংশ, বাকিটা ঐচ্ছিক। সপ্তাহের শেষ কাজের দিনে বাকি সব বাধ্যতামূলক।',
                "A mandatory share each day, the rest optional. Whatever is left becomes mandatory on the week's last working day."
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-pro min-w-[880px]">
          <thead>
            <tr>
              <th>{L('কর্মী', 'Employee')}</th>
              <th>{L('কাজ', 'Task')}</th>
              <th>{L('আজ বাধ্যতামূলক', 'Mandatory today')}</th>
              <th className="text-right">{L('আজ সাধারণ', 'Normal today')}</th>
              <th className="text-right">{L('আজ সম্পন্ন', 'Done today')}</th>
              <th className="text-right">{L('এই সপ্তাহে সম্পন্ন', 'Done this week')}</th>
              <th className="text-right">{L('বাকি', 'Remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.targetId}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={q.employeeName || 'E'} size={30} animated={false} />
                    <span className="font-medium text-slate-900">{q.employeeName}</span>
                  </div>
                </td>
                <td>
                  <div className="font-medium text-slate-800">
                    {metricLabel(q.metricType)} · <span className="tabular-nums">{q.amount}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {q.sectionName ? `${q.sectionName} · ` : ''}
                    <span className="tabular-nums">
                      {q.rangeStart === q.rangeEnd ? L('প্রতিদিন', 'Every day') : `${q.rangeStart} → ${q.rangeEnd}`}
                    </span>
                    {q.offDays.length > 0 && (
                      <> · {L('ছুটি', 'Off')}: {q.offDays.map((d) => L(WEEKDAYS[d].bn, WEEKDAYS[d].en)).join(', ')}</>
                    )}
                  </div>
                </td>
                <td>
                  {q.isOffDay ? (
                    <span className="badge badge-gray">{L('ছুটির দিন', 'Off day')}</span>
                  ) : (
                    <span className={`badge tabular-nums ${q.mandatoryLeft > 0 ? 'badge-amber' : 'badge-green'}`}>
                      {q.mandatory - q.mandatoryLeft}/{q.mandatory}
                      {q.isLastWorkingDay && q.rangeStart !== q.rangeEnd && ` · ${L('শেষ দিন', 'last day')}`}
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {q.normal - q.normalLeft}/{q.normal}
                </td>
                <td className="text-right tabular-nums">{q.doneToday}</td>
                <td className="text-right tabular-nums">{q.doneBeforeToday + q.doneToday}</td>
                <td className="text-right tabular-nums">
                  <span className="font-medium text-slate-900">{q.remaining}</span>
                  <div className="text-xs text-slate-500">
                    {L('শেষ', 'by')} {q.windowEnd}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
