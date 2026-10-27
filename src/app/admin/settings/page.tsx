'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Globe,
  Hash,
  History,
  Info,
} from 'lucide-react';
import { toBengaliDigits } from '@/lib/date';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';

interface SectionWeights {
  SALES_PROFIT: number;
  CONTENT: number;
  NEW_BUYERS_B2B: number;
  RETENTION: number;
  INBOX_FOLLOWUP: number;
}

interface SettingsState {
  section_weights: SectionWeights;
  achievement_cap: number;
  failing_threshold: number;
  undo_enabled: boolean;
  employee_edit_window_days: number;
  weekly_report_day: string;
  weekly_report_time: string;
  language_default: string;
  digit_style: string;
  updated_at?: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  section_weights: {
    SALES_PROFIT: 30,
    CONTENT: 20,
    NEW_BUYERS_B2B: 20,
    RETENTION: 15,
    INBOX_FOLLOWUP: 15,
  },
  achievement_cap: 1.0,
  failing_threshold: 0.8,
  undo_enabled: true,
  employee_edit_window_days: 1,
  weekly_report_day: 'SUNDAY',
  weekly_report_time: '09:00',
  language_default: 'bn',
  digit_style: 'bn',
};





export default function AdminSettingsPage() {
  const { L } = useLanguage();
  const SECTION_CONFIG = [
    {
      key: 'SALES_PROFIT' as keyof SectionWeights,
      nameBn: L('বিক্রি ও লাভ'),
      nameEn: 'Sales & Profit',
      descBn: L('মোট বিক্রয় ও মোট মুনাফা অর্জনের ওজন'),
      color: 'emerald',
    },
    {
      key: 'CONTENT' as keyof SectionWeights,
      nameBn: L('কনটেন্ট ও পোস্ট বাস্তবায়ন'),
      nameEn: 'Content',
      descBn: L('গ্রুপ পোস্ট ও মিডিয়া পাবলিশিং কার্যকারিতার ওজন'),
      color: 'blue',
    },
    {
      key: 'NEW_BUYERS_B2B' as keyof SectionWeights,
      nameBn: L('নতুন ক্রেতা ও B2B বিক্রি'),
      nameEn: 'New Buyers & B2B',
      descBn: L('নতুন কাস্টমার সংগ্রহ ও পাইকারি অর্ডার অর্জনের ওজন'),
      color: 'indigo',
    },
    {
      key: 'RETENTION' as keyof SectionWeights,
      nameBn: L('পুরোনো ক্রেতা ধরে রাখা'),
      nameEn: 'Retention',
      descBn: L('রিপিট পারচেজ ও পুরোনো গ্রাহক ধরে রাখার সক্ষমতা'),
      color: 'amber',
    },
    {
      key: 'INBOX_FOLLOWUP' as keyof SectionWeights,
      nameBn: L('ইনবক্স ও ফলোআপ'),
      nameEn: 'Inbox & Follow-up',
      descBn: L('গ্রাহকদের বার্তা উত্তর ও নিয়মিত যোগাযোগ সম্পন্নের ওজন'),
      color: 'purple',
    },
  ];
  const WEEK_DAYS = [
    { value: 'SUNDAY', labelBn: L('রবিবার') },
    { value: 'MONDAY', labelBn: L('সোমবার') },
    { value: 'TUESDAY', labelBn: L('মঙ্গলবার') },
    { value: 'WEDNESDAY', labelBn: L('বুধবার') },
    { value: 'THURSDAY', labelBn: L('বৃহস্পতিবার') },
    { value: 'FRIDAY', labelBn: L('শুক্রবার') },
    { value: 'SATURDAY', labelBn: L('শনিবার') },
  ];
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastAuditTimestamp, setLastAuditTimestamp] = useState<string | null>(null);

  // Fetch initial settings
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/settings');
        if (!res.ok) {
          throw new Error(L('সেটিংস লোড করতে ব্যর্থ হয়েছে'));
        }
        const data = await res.json();
        if (data.settings) {
          setSettings({
            section_weights: {
              SALES_PROFIT: Number(data.settings.section_weights?.SALES_PROFIT ?? 30),
              CONTENT: Number(data.settings.section_weights?.CONTENT ?? 20),
              NEW_BUYERS_B2B: Number(data.settings.section_weights?.NEW_BUYERS_B2B ?? 20),
              RETENTION: Number(data.settings.section_weights?.RETENTION ?? 15),
              INBOX_FOLLOWUP: Number(data.settings.section_weights?.INBOX_FOLLOWUP ?? 15),
            },
            achievement_cap: Number(data.settings.achievement_cap ?? 1.0),
            failing_threshold: Number(data.settings.failing_threshold ?? 0.8),
            undo_enabled: Boolean(data.settings.undo_enabled ?? true),
            employee_edit_window_days: Number(data.settings.employee_edit_window_days ?? 1),
            weekly_report_day: data.settings.weekly_report_day ?? 'SUNDAY',
            weekly_report_time: data.settings.weekly_report_time ?? '09:00',
            language_default: data.settings.language_default ?? 'bn',
            digit_style: data.settings.digit_style ?? 'bn',
            updated_at: data.settings.updated_at,
          });
          if (data.settings.updated_at) {
            setLastAuditTimestamp(new Date(data.settings.updated_at).toLocaleString('bn-BD'));
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : L('সেটিংস লোড করতে সমস্যা হয়েছে');
        setErrorMsg(message);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // Calculate sum of weights
  const currentSum = Math.round(
    ((Number(settings.section_weights.SALES_PROFIT) || 0) +
      (Number(settings.section_weights.CONTENT) || 0) +
      (Number(settings.section_weights.NEW_BUYERS_B2B) || 0) +
      (Number(settings.section_weights.RETENTION) || 0) +
      (Number(settings.section_weights.INBOX_FOLLOWUP) || 0)) *
      100
  ) / 100;

  const isSumValid = currentSum === 100;

  const handleWeightChange = (key: keyof SectionWeights, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setSettings((prev) => ({
      ...prev,
      section_weights: {
        ...prev.section_weights,
        [key]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSumValid) {
      setErrorMsg(L(`সেকশন ওয়েটগুলোর যোগফল ঠিক ১০০% হতে হবে (বর্তমান যোগফল: ${currentSum}%)`));
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        section_weights: settings.section_weights,
        achievement_cap: Number(settings.achievement_cap),
        failing_threshold: Number(settings.failing_threshold),
        undo_enabled: settings.undo_enabled,
        employee_edit_window_days: Number(settings.employee_edit_window_days),
        weekly_report_day: settings.weekly_report_day,
        weekly_report_time: settings.weekly_report_time,
        language_default: settings.language_default,
        digit_style: settings.digit_style,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || L('সেটিংস সংরক্ষণ ব্যর্থ হয়েছে'));
      }

      setSuccessMsg(L('সেটিংস সংরক্ষিত হয়েছে। পরিবর্তন এখনই কার্যকর।'));
      const nowBn = new Date().toLocaleString('bn-BD');
      setLastAuditTimestamp(nowBn);

      // Auto dismiss success toast after 6 seconds
      setTimeout(() => {
        setSuccessMsg('');
      }, 6000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : L('সেটিংস সংরক্ষণ করতে ত্রুটি হয়েছে');
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm(L('আপনি কি ডিফল্ট সেটিংস ফিরিয়ে আনতে চান? (সংরক্ষণের জন্য Save বাটনে চাপতে হবে)'))) {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        updated_at: prev.updated_at,
      }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">{L("লোড হচ্ছে...")}</span>
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <SkeletonStatCards count={3} className="grid grid-cols-1 gap-4 sm:grid-cols-3" />
        <div className="card space-y-4 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const capOptions = [
    { value: 1.0, title: L('১০০%'), note: 'স্ট্যান্ডার্ড, বোনাস নেই' },
    { value: 1.2, title: L('১২০%'), note: 'টার্গেটের ১২০% পর্যন্ত' },
    { value: 999, title: L('নো ক্যাপ'), note: 'যত কাজ তত স্কোর' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-5 w-5" />}
        title={L("সেটিংস")}
        subtitle={L("স্কোরিং নীতি, কর্মী অনুমতি ও রিপোর্ট শিডিউল")}
      />

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">{successMsg}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              {L("অডিট লগে রেকর্ড হয়েছে")}
              {lastAuditTimestamp && <span>· {lastAuditTimestamp}</span>}
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section weights */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{L("সেকশন ওয়েট")}</h2>
              <p className="card-subtitle">{L("৫টি সেকশনের গুরুত্ব। যোগফল ঠিক ১০০% হতে হবে।")}</p>
            </div>
            <span className={`badge ${isSumValid ? 'badge-green' : 'badge-red'}`}>
              {isSumValid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {L("মোট")} {toBengaliDigits(currentSum)}%
              {!isSumValid &&
                (currentSum > 100
                  ? L(` · ${toBengaliDigits(currentSum - 100)}% বেশি`)
                  : L(` · ${toBengaliDigits(100 - currentSum)}% বাকি`))}
            </span>
          </div>
          <div className="card-body space-y-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${
                  isSumValid ? 'bg-brand-600' : currentSum > 100 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(currentSum, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {SECTION_CONFIG.map((sec) => (
                <div key={sec.key} className="min-w-0">
                  <label className="label" htmlFor={`weight-${sec.key}`} title={sec.descBn}>
                    {sec.nameBn}
                  </label>
                  <div className="relative">
                    <input
                      id={`weight-${sec.key}`}
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={settings.section_weights[sec.key]}
                      onChange={(e) => handleWeightChange(sec.key, e.target.value)}
                      className="input pr-8 tabular-nums"
                      required
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                      %
                    </span>
                  </div>
                  <p className="hint">{sec.nameEn}</p>
                </div>
              ))}
            </div>

            {!isSumValid && (
              <div className="alert alert-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{L("যোগফল ১০০% না হলে সংরক্ষণ করা যাবে না।")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scoring rules */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">{L("স্কোরিং নিয়ম")}</h2>
              <p className="card-subtitle">{L("সর্বোচ্চ স্কোর সীমা ও ফেল করার সীমা")}</p>
            </div>
          </div>
          <div className="card-body grid grid-cols-1 gap-6 lg:grid-cols-2">
            <fieldset>
              <legend className="label">{L("অ্যাচিভমেন্ট ক্যাপ")}</legend>
              <p className="hint mb-3 mt-0">{L("টার্গেটের বেশি কাজ করলে সর্বোচ্চ কত স্কোর")}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {capOptions.map((opt) => {
                  const active = settings.achievement_cap === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSettings((s) => ({ ...s, achievement_cap: opt.value }))}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className={`block text-sm font-semibold ${active ? 'text-brand-800' : 'text-slate-900'}`}>
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">{opt.note}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label className="label" htmlFor="failing-threshold">{L("ফেল থ্রেশহোল্ড")}</label>
              <p className="hint mb-3 mt-0">{L("এই স্কোরের নিচে কর্মী &ldquo;উন্নতি প্রয়োজন&rdquo; চিহ্নিত হবে")}</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    aria-label={L("ফেল থ্রেশহোল্ড স্লাইডার")}
                    value={settings.failing_threshold}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, failing_threshold: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full cursor-pointer accent-brand-600"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                    <span>{L("০%")}</span>
                    <span>{L("৫০%")}</span>
                    <span>{L("১০০%")}</span>
                  </div>
                </div>
                <div className="relative w-20 shrink-0">
                  <input
                    id="failing-threshold"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(settings.failing_threshold * 100)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSettings((s) => ({ ...s, failing_threshold: Math.min(Math.max(val / 100, 0), 1) }));
                    }}
                    className="input pr-7 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
                    %
                  </span>
                </div>
              </div>
              <p className="hint flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {L("ডিফল্ট ৮০%। ড্যাশবোর্ড ও দৈনিক রিপোর্টে প্রযোজ্য।")}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Employee permissions */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{L("কর্মী অনুমতি")}</h2>
                <p className="card-subtitle">{L("আনডু ও পুরোনো এন্ট্রি এডিট")}</p>
              </div>
            </div>
            <div className="card-body space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">{L("লিংক আনডু")}</div>
                  <p className="text-xs text-slate-500">{L("কর্মীরা সম্পন্ন লিংক আনডু করতে পারবে")}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.undo_enabled}
                  aria-label={L("লিংক আনডু")}
                  onClick={() => setSettings((s) => ({ ...s, undo_enabled: !s.undo_enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    settings.undo_enabled ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.undo_enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="label" htmlFor="edit-window">{L("এডিট উইন্ডো (দিন)")}</label>
                <input
                  id="edit-window"
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  value={settings.employee_edit_window_days}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      employee_edit_window_days: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="input w-28 tabular-nums"
                  required
                />
                <p className="hint">{L("০ = শুধু আজ, ১ = আজ ও গতকাল, ৭ = বিগত ৭ দিন")}</p>
              </div>
            </div>
          </div>

          {/* Schedule & locale */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{L("রিপোর্ট শিডিউল ও ভাষা")}</h2>
                <p className="card-subtitle">{L("সাপ্তাহিক রিপোর্ট, ডিফল্ট ভাষা ও সংখ্যা")}</p>
              </div>
            </div>
            <div className="card-body space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="report-day">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {L("রিপোর্টের দিন")}
                  </label>
                  <select
                    id="report-day"
                    value={settings.weekly_report_day}
                    onChange={(e) => setSettings((s) => ({ ...s, weekly_report_day: e.target.value }))}
                    className="input"
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.labelBn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label flex items-center gap-1.5" htmlFor="report-time">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {L("রিপোর্টের সময়")}
                  </label>
                  <input
                    id="report-time"
                    type="time"
                    value={settings.weekly_report_time}
                    onChange={(e) => setSettings((s) => ({ ...s, weekly_report_time: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="label flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    {L("ডিফল্ট ভাষা")}
                  </span>
                  <div className="segmented w-full" role="group" aria-label={L("ডিফল্ট ভাষা")}>
                    <button
                      type="button"
                      className="flex-1"
                      data-active={settings.language_default === 'bn'}
                      onClick={() => setSettings((s) => ({ ...s, language_default: 'bn' }))}
                    >
                      {L("বাংলা")}
                    </button>
                    <button
                      type="button"
                      className="flex-1"
                      data-active={settings.language_default === 'en'}
                      onClick={() => setSettings((s) => ({ ...s, language_default: 'en' }))}
                    >
                      English
                    </button>
                  </div>
                </div>
                <div>
                  <span className="label flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    {L("সংখ্যা")}
                  </span>
                  <div className="segmented w-full" role="group" aria-label={L("সংখ্যা প্রদর্শন")}>
                    <button
                      type="button"
                      className="flex-1"
                      data-active={settings.digit_style === 'bn'}
                      onClick={() => setSettings((s) => ({ ...s, digit_style: 'bn' }))}
                    >
                      {L("০-৯")}
                    </button>
                    <button
                      type="button"
                      className="flex-1"
                      data-active={settings.digit_style === 'en'}
                      onClick={() => setSettings((s) => ({ ...s, digit_style: 'en' }))}
                    >
                      0-9
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky save bar */}
        <div className="card sticky bottom-4 z-20 flex flex-col gap-3 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              {lastAuditTimestamp
                ? L(`সর্বশেষ সংরক্ষিত: ${lastAuditTimestamp}`)
                : L('প্রতিটি পরিবর্তন অডিট লগে রেকর্ড হয়')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleResetToDefaults} className="btn btn-ghost">
              <RotateCcw className="h-4 w-4" />
              {L("ডিফল্টে ফেরান")}
            </button>
            <button type="submit" disabled={saving || !isSumValid} className="btn btn-primary">
              <Save className="h-4 w-4" />
              {saving ? L('সংরক্ষণ হচ্ছে...') : L('সংরক্ষণ করুন')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
