'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

type Period = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface QuotaRow {
  quotaId: string;
  employeeId: string;
  employeeName: string;
  sectionId: string | null;
  sectionName: string | null;
  period: Period;
  amount: number;
  offDays: number[];
  isOffDay: boolean;
  mandatory: number;
  mandatoryLeft: number;
  normal: number;
  normalLeft: number;
  doneToday: number;
  remaining: number;
  windowEnd: string;
  isLastWorkingDay: boolean;
}

const WEEKDAYS: { bn: string; en: string }[] = [
  { bn: 'রবি', en: 'Sun' },
  { bn: 'সোম', en: 'Mon' },
  { bn: 'মঙ্গল', en: 'Tue' },
  { bn: 'বুধ', en: 'Wed' },
  { bn: 'বৃহঃ', en: 'Thu' },
  { bn: 'শুক্র', en: 'Fri' },
  { bn: 'শনি', en: 'Sat' },
];

export default function TaskQuotasPage() {
  const { L } = useLanguage();
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [period, setPeriod] = useState<Period>('WEEKLY');
  const [amount, setAmount] = useState('7');
  const [offDays, setOffDays] = useState<number[]>([5]);

  const PERIOD_LABEL: Record<Period, string> = {
    DAILY: L('দৈনিক', 'Daily'),
    WEEKLY: L('সাপ্তাহিক', 'Weekly'),
    MONTHLY: L('মাসিক', 'Monthly'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, e, s] = await Promise.all([
        fetch('/api/admin/task-quotas').then((r) => r.json()),
        fetch('/api/admin/employees').then((r) => r.json()),
        fetch('/api/admin/sections').then((r) => r.json()),
      ]);
      setQuotas(q.quotas ?? []);
      setEmployees((e.employees ?? []).map((x: any) => ({ id: x.id, name: x.name })));
      setSections((s.sections ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    } catch {
      setError(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setLoading(false);
    }
  }, [L]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (d: number) =>
    setOffDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const save = async () => {
    setError('');
    setSuccess('');
    if (!employeeId) {
      setError(L('কর্মী নির্বাচন করুন', 'Select an employee'));
      return;
    }
    if (offDays.length >= 7) {
      setError(L('অন্তত একটি কাজের দিন রাখুন', 'Keep at least one working day'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/task-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          section_id: sectionId || null,
          period,
          amount: Number(amount),
          off_days: offDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(L(data.error || 'ব্যর্থ হয়েছে'));
        return;
      }
      setSuccess(L('কাজের কোটা সংরক্ষিত হয়েছে', 'Task quota saved'));
      await load();
    } catch {
      setError(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/task-quotas?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) setQuotas((prev) => prev.filter((q) => q.quotaId !== id));
  };

  const perDayHint = () => {
    const n = Number(amount) || 0;
    const workDays = 7 - offDays.length;
    if (period === 'DAILY') return L(`প্রতিদিন ${n}টি বাধ্যতামূলক`, `${n} mandatory every working day`);
    if (period === 'WEEKLY') {
      const base = workDays > 0 ? Math.max(1, Math.floor(n / workDays)) : 0;
      return L(
        `প্রতিদিন ${base}টি বাধ্যতামূলক; সপ্তাহের শেষ কাজের দিনে বাকি সব বাধ্যতামূলক`,
        `${base} mandatory a day; whatever is left becomes mandatory on the week's last working day`
      );
    }
    return L(
      'মাসের কাজের দিনগুলোতে ভাগ হবে; কম হলে পরের সপ্তাহে যোগ হবে, মাসের শেষ কাজের দিনে পুরো কোটা পূরণ করতে হবে',
      "Spread over the month's working days; a shortfall moves to the next week, and the full quota closes on the month's last working day"
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarClock className="h-5 w-5" />}
        title={L('কাজের কোটা', 'Task quotas')}
        subtitle={L(
          'দৈনিক, সাপ্তাহিক বা মাসিক কাজ দিন; সিস্টেম প্রতিদিনের বাধ্যতামূলক ও সাধারণ কাজ হিসাব করবে',
          'Give daily, weekly or monthly work; the system works out each day’s mandatory and normal tasks'
        )}
      />

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{L('নতুন কোটা', 'New quota')}</h2>
          <span className="card-subtitle">{L('একই কর্মী ও সেকশনে আবার দিলে আগেরটা বদলে যাবে', 'Saving again for the same employee and section replaces it')}</span>
        </div>
        <div className="card-body grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">{L('কর্মী', 'Employee')}</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">{L('নির্বাচন করুন', 'Select')}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{L('সেকশন', 'Section')}</label>
            <select className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">{L('সব সেকশন', 'All sections')}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{L('সময়কাল', 'Period')}</label>
            <div className="segmented w-full">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as Period[]).map((p) => (
                <button key={p} type="button" data-active={period === p} onClick={() => setPeriod(p)} className="flex-1">
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{L('কাজের সংখ্যা', 'Number of tasks')}</label>
            <input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">{L('ছুটির দিন', 'Off days')}</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => {
                const off = offDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`press rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                      off ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {L(d.bn, d.en)}
                  </button>
                );
              })}
            </div>
            <p className="hint">{perDayHint()}</p>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {L('সংরক্ষণ করুন', 'Save')}
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="card-title">{L('আজকের অবস্থা', "Today's status")}</h2>
        </div>
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : quotas.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-5 w-5" />}
            title={L('এখনো কোনো কোটা নেই', 'No quotas yet')}
            description={L('উপরের ফর্ম থেকে একজন কর্মীকে কাজ দিন।', 'Give an employee work using the form above.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{L('কর্মী', 'Employee')}</th>
                  <th>{L('কোটা', 'Quota')}</th>
                  <th>{L('আজ বাধ্যতামূলক', 'Mandatory today')}</th>
                  <th>{L('আজ সাধারণ', 'Normal today')}</th>
                  <th>{L('আজ সম্পন্ন', 'Done today')}</th>
                  <th>{L('বাকি', 'Remaining')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quotas.map((q) => (
                  <tr key={q.quotaId}>
                    <td>
                      <div className="font-medium text-slate-900">{q.employeeName}</div>
                      <div className="text-xs text-slate-500">{q.sectionName ?? L('সব সেকশন', 'All sections')}</div>
                    </td>
                    <td>
                      <span className="badge badge-violet">{PERIOD_LABEL[q.period]}</span>{' '}
                      <span className="tabular-nums">{q.amount}</span>
                      {q.offDays.length > 0 && (
                        <div className="text-xs text-slate-500">
                          {L('ছুটি', 'Off')}: {q.offDays.map((d) => L(WEEKDAYS[d].bn, WEEKDAYS[d].en)).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      {q.isOffDay ? (
                        <span className="badge badge-gray">{L('ছুটির দিন', 'Off day')}</span>
                      ) : (
                        <span className={`badge ${q.mandatoryLeft > 0 ? 'badge-red' : 'badge-green'}`}>
                          {q.mandatory - q.mandatoryLeft}/{q.mandatory}
                          {q.isLastWorkingDay && ` · ${L('শেষ দিন', 'last day')}`}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums">{q.normal - q.normalLeft}/{q.normal}</td>
                    <td className="tabular-nums">{q.doneToday}</td>
                    <td className="tabular-nums">
                      {q.remaining}
                      <div className="text-xs text-slate-500">{L('শেষ', 'by')} {q.windowEnd}</div>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => remove(q.quotaId)}
                        className="btn-icon hover:text-rose-600"
                        aria-label={L('মুছুন', 'Delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
