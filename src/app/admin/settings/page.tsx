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
  Activity,
  History,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import { toBengaliDigits } from '@/lib/date';

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

const SECTION_CONFIG = [
  {
    key: 'SALES_PROFIT' as keyof SectionWeights,
    nameBn: 'বিক্রি ও লাভ (Sales & Profit)',
    descBn: 'মোট বিক্রয় ও মোট মুনাফা অর্জনের ওজন',
    color: 'emerald',
  },
  {
    key: 'CONTENT' as keyof SectionWeights,
    nameBn: 'কনটেন্ট ও পোস্ট বাস্তবায়ন (Content)',
    descBn: 'গ্রুপ পোস্ট ও মিডিয়া পাবলিশিং কার্যকারিতার ওজন',
    color: 'blue',
  },
  {
    key: 'NEW_BUYERS_B2B' as keyof SectionWeights,
    nameBn: 'নতুন ক্রেতা ও B2B বিক্রি (New Buyers & B2B)',
    descBn: 'নতুন কাস্টমার সংগ্রহ ও পাইকারি অর্ডার অর্জনের ওজন',
    color: 'indigo',
  },
  {
    key: 'RETENTION' as keyof SectionWeights,
    nameBn: 'পুরোনো ক্রেতা ধরে রাখা (Retention)',
    descBn: 'রিপিট পারচেজ ও পুরোনো গ্রাহক ধরে রাখার সক্ষমতা',
    color: 'amber',
  },
  {
    key: 'INBOX_FOLLOWUP' as keyof SectionWeights,
    nameBn: 'ইনবক্স ও ফলোআপ (Inbox & Follow-up)',
    descBn: 'গ্রাহকদের বার্তা উত্তর ও নিয়মিত যোগাযোগ সম্পন্নের ওজন',
    color: 'purple',
  },
];

const WEEK_DAYS = [
  { value: 'SUNDAY', labelBn: 'রবিবার (Sunday)' },
  { value: 'MONDAY', labelBn: 'সোমবার (Monday)' },
  { value: 'TUESDAY', labelBn: 'মঙ্গলবার (Tuesday)' },
  { value: 'WEDNESDAY', labelBn: 'বুধবার (Wednesday)' },
  { value: 'THURSDAY', labelBn: 'বৃহস্পতিবার (Thursday)' },
  { value: 'FRIDAY', labelBn: 'শুক্রবার (Friday)' },
  { value: 'SATURDAY', labelBn: 'শনিবার (Saturday)' },
];

export default function AdminSettingsPage() {
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
          throw new Error('সেটিংস লোড করতে ব্যর্থ হয়েছে');
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
        const message = err instanceof Error ? err.message : 'সেটিংস লোড করতে সমস্যা হয়েছে';
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
      setErrorMsg(`সেকশন ওয়েটগুলোর যোগফল ঠিক ১০০% হতে হবে (বর্তমান যোগফল: ${currentSum}%)`);
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
        throw new Error(data.error || 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে');
      }

      setSuccessMsg(
        'সিস্টেম সেটিংস সফলভাবে সংরক্ষিত ও আপডেট হয়েছে! স্কোরিং নীতি ও শিডিউলে পরিবর্তন অবিলম্বে কার্যকর হবে।'
      );
      const nowBn = new Date().toLocaleString('bn-BD');
      setLastAuditTimestamp(nowBn);

      // Auto dismiss success toast after 6 seconds
      setTimeout(() => {
        setSuccessMsg('');
      }, 6000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'সেটিংস সংরক্ষণ করতে ত্রুটি হয়েছে';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('আপনি কি ডিফল্ট সেটিংস ফিরিয়ে আনতে চান? (সংরক্ষণের জন্য Save বাটনে চাপতে হবে)')) {
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        updated_at: prev.updated_at,
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-600">সেটিংস লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">সিস্টেম ও স্কোরিং সেটিংস</h1>
              <p className="text-xs text-slate-500">
                হেড অব মার্কেটিং কন্ট্রোল সেন্টার — স্কোরিং অ্যালগরিদম, ওয়েটিং, শিডিউল ও সিস্টেম রুলস কনফিগারেশন
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            ডিফল্ট মান
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !isSumValid}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all ${
              saving || !isSumValid
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
            }`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'পরিবর্তন সংরক্ষণ করুন'}
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-emerald-900 shadow-sm transition-all">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold">{successMsg}</p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>সিস্টেম অডিট লগ সংরক্ষিত হয়েছে</span>
              {lastAuditTimestamp && (
                <>
                  <span>•</span>
                  <span>সর্বশেষ আপডেট: {lastAuditTimestamp}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 border border-rose-200 text-rose-800 shadow-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <span className="text-xs font-bold">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Section Weights with Real-time Sum Calculator */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                ১
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">সেকশন ওয়েট কনফিগারেশন (Section Weights)</h2>
                <p className="text-xs text-slate-500">
                  ৫টি প্রধান সেকশনের গুরুত্ব নির্ধারণ করুন। সকল সেকশনের ওয়েটের যোগফল অবশ্যই ঠিক ১০০% হতে হবে।
                </p>
              </div>
            </div>

            {/* Real-time Sum Meter */}
            <div
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold border transition-colors ${
                isSumValid
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              {isSumValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>
                মোট ওয়েট: {toBengaliDigits(currentSum)}% / ১০০%{' '}
                {isSumValid ? '(সঠিক)' : currentSum > 100 ? `(${toBengaliDigits(currentSum - 100)}% অতিরিক্ত)` : `(${toBengaliDigits(100 - currentSum)}% বাকি)`}
              </span>
            </div>
          </div>

          {/* Sum Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${
                  isSumValid ? 'bg-emerald-500' : currentSum > 100 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(currentSum, 100)}%` }}
              />
            </div>
            {!isSumValid && (
              <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                সতর্কতা: ওয়েটগুলোর যোগফল ঠিক ১০০% না হওয়া পর্যন্ত নতুন সেটিংস সংরক্ষণ করা যাবে না।
              </p>
            )}
          </div>

          {/* Grid of Weight Inputs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SECTION_CONFIG.map((sec) => (
              <div
                key={sec.key}
                className="relative rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1" title={sec.nameBn}>
                    {sec.nameBn}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-2 h-7">{sec.descBn}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={settings.section_weights[sec.key]}
                    onChange={(e) => handleWeightChange(sec.key, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Achievement Cap & Failing Threshold */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Achievement Cap Selector */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                ২
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">অ্যাচিভমেন্ট ক্যাপ (Achievement Cap)</h2>
                <p className="text-xs text-slate-500">টার্গেটের চেয়ে বেশি কাজ করলে সর্বোচ্চ কত শতাংশ স্কোর পাবে</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 100% / 1.0 */}
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, achievement_cap: 1.0 }))}
                className={`flex flex-col items-center justify-center rounded-lg border p-3.5 text-center transition-all ${
                  settings.achievement_cap === 1.0
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-base font-bold">১০০% (1.0)</span>
                <span className="text-[11px] font-medium text-slate-500 mt-1">স্ট্যান্ডার্ড ক্যাপ</span>
                <span className="text-[10px] text-slate-400 mt-0.5">অতিরিক্ত বোনাস স্কোর নেই</span>
              </button>

              {/* 120% / 1.2 */}
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, achievement_cap: 1.2 }))}
                className={`flex flex-col items-center justify-center rounded-lg border p-3.5 text-center transition-all ${
                  settings.achievement_cap === 1.2
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-base font-bold">১২০% (1.2)</span>
                <span className="text-[11px] font-medium text-slate-500 mt-1">২০% ওভার-বোনাস</span>
                <span className="text-[10px] text-slate-400 mt-0.5">টার্গেটের ১২০% পর্যন্ত স্কোরিং</span>
              </button>

              {/* No Cap / 999 */}
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, achievement_cap: 999 }))}
                className={`flex flex-col items-center justify-center rounded-lg border p-3.5 text-center transition-all ${
                  settings.achievement_cap === 999
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-base font-bold">নো ক্যাপ (999)</span>
                <span className="text-[11px] font-medium text-slate-500 mt-1">সীমাহীন অর্জন</span>
                <span className="text-[10px] text-slate-400 mt-0.5">যতটুকু করবে ততটুকুই স্কোর</span>
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">
              <Info className="h-4 w-4 shrink-0 text-slate-400" />
              <span>
                বর্তমানে নির্বাচিত: <strong>{settings.achievement_cap === 999 ? 'নো ক্যাপ (No Cap)' : `${toBengaliDigits(Math.round(settings.achievement_cap * 100))}%`}</strong>
              </span>
            </div>
          </div>

          {/* Failing Threshold */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                ৩
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">ব্যর্থতা থ্রেশহোল্ড (Failing Threshold)</h2>
                <p className="text-xs text-slate-500">কোন স্কোরের নিচে নামলে কর্মীকে লাল সংকেত (Failing) চিহ্নিত করবে</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.failing_threshold}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, failing_threshold: parseFloat(e.target.value) || 0 }))
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>০%</span>
                    <span>৫০%</span>
                    <span>৮০% (ডিফল্ট)</span>
                    <span>১০০%</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(settings.failing_threshold * 100)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSettings((s) => ({ ...s, failing_threshold: Math.min(Math.max(val / 100, 0), 1) }));
                    }}
                    className="w-12 bg-transparent text-right text-sm font-bold text-slate-900 outline-none"
                  />
                  <span className="text-xs font-bold text-slate-600">%</span>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50/80 p-3 border border-amber-200/80 text-[11px] text-amber-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Activity className="h-3.5 w-3.5 text-amber-600" />
                  <span>ইমপ্যাক্ট বিশ্লেষণ:</span>
                </div>
                <p>
                  স্কোর <strong>{toBengaliDigits(Math.round(settings.failing_threshold * 100))}%</strong> এর কম হলে
                  কর্মীর পারফরম্যান্স ড্যাশবোর্ড ও দৈনিক রিপোর্টে লাল সংকেত (অব্যাহতি / ইমপ্রুভমেন্ট ফ্ল্যাগ) প্রদর্শিত হবে।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Employee Workflow & Automation */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Undo & Edit Window */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                ৪
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">কর্মী ওয়ার্কফ্লো ও এডিট নীতি</h2>
                <p className="text-xs text-slate-500">লিংক আনডু অনুমতি ও পেছনের তথ্য এডিটের দিনসীমা</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Undo Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">লিংক আনডু (Undo) সক্রিয়তা</div>
                  <div className="text-[11px] text-slate-500">
                    কর্মীরা কি সম্পন্ন করা লিংকের মার্ক আনডু করতে পারবে?
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, undo_enabled: !s.undo_enabled }))}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    settings.undo_enabled
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {settings.undo_enabled ? (
                    <>
                      <ToggleRight className="h-4 w-4" />
                      <span>অন (Active)</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-4 w-4" />
                      <span>অফ (Disabled)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Employee Edit Window */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800">এডিট উইন্ডো (Edit Window Days)</label>
                    <p className="text-[11px] text-slate-500">
                      কর্মী পেছনের কতদিনের দৈনিক পারফরম্যান্স এন্ট্রি এডিট করতে পারবে
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
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
                      className="w-16 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-center text-sm font-bold text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      required
                    />
                    <span className="text-xs font-bold text-slate-500">দিন</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  (০ = শুধুমাত্র আজকের দিন, ১ = আজকের দিন ও গতকাল, ৭ = বিগত ৭ দিন)
                </p>
              </div>
            </div>
          </div>

          {/* Weekly Report Schedule & Localization */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                ৫
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">সাপ্তাহিক রিপোর্ট শিডিউল ও লোকাল</h2>
                <p className="text-xs text-slate-500">অটোমেশন রান শিডিউল, ডিফল্ট ভাষা ও সংখ্যা প্রদর্শন শৈলী</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Weekly Report Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    সাপ্তাহিক রিপোর্ট দিন
                  </label>
                  <select
                    value={settings.weekly_report_day}
                    onChange={(e) => setSettings((s) => ({ ...s, weekly_report_day: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.labelBn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    রিপোর্ট প্রকাশের সময়
                  </label>
                  <input
                    type="time"
                    value={settings.weekly_report_time}
                    onChange={(e) => setSettings((s) => ({ ...s, weekly_report_time: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Language and Digit Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                {/* Language Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-500" />
                    ডিফল্ট ভাষা (Language)
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, language_default: 'bn' }))}
                      className={`rounded py-1 text-xs font-bold transition-all ${
                        settings.language_default === 'bn'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      বাংলা (bn)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, language_default: 'en' }))}
                      className={`rounded py-1 text-xs font-bold transition-all ${
                        settings.language_default === 'en'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English (en)
                    </button>
                  </div>
                </div>

                {/* Digit Style Toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-slate-500" />
                    সংখ্যা প্রদর্শন (Digit Style)
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, digit_style: 'bn' }))}
                      className={`rounded py-1 text-xs font-bold transition-all ${
                        settings.digit_style === 'bn'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      বাংলা ০-৯
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, digit_style: 'en' }))}
                      className={`rounded py-1 text-xs font-bold transition-all ${
                        settings.digit_style === 'en'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      English 0-9
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Save Bar */}
        <div className="sticky bottom-4 z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <History className="h-4 w-4 text-slate-400" />
            <span>
              {lastAuditTimestamp
                ? `সর্বশেষ সংরক্ষিত: ${lastAuditTimestamp} — প্রতি পরিবর্তনে স্বয়ংক্রিয় অডিট লগ রেকর্ড হয়`
                : 'প্রতিটি পরিবর্তনের জন্য সিস্টেম স্বয়ংক্রিয়ভাবে অ্যাডমিন আইডি সহ অডিট লগ তৈরি করে'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              রিসেট
            </button>
            <button
              type="submit"
              disabled={saving || !isSumValid}
              className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-bold text-white shadow transition-all ${
                saving || !isSumValid
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
              }`}
            >
              <Save className="h-4 w-4" />
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
