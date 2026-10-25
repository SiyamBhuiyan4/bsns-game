'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  DollarSign,
  Copy,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Filter,
  TrendingUp,
  Info,
} from 'lucide-react';
import { formatTaka } from '@/lib/date';
import {
  calculateTargetLivePreview,
  findOverlappingTarget,
  calculateBudgetStatus,
} from '@/lib/targets';

interface Section {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
  channel: string;
  budget_amount: number;
  status: string;
}

interface SectionTarget {
  id: string;
  section_id: string;
  metric_type: string;
  target_value: number;
  period_type: string;
  period_start: string | null;
  period_end: string | null;
  section: { id: string; name: string };
  creator: { id: string; name: string; email: string };
  created_at: string;
}

interface CampaignBudget {
  id: string;
  campaign_id: string;
  amount: number;
  campaign?: {
    id: string;
    name: string;
    channel: string;
    status: string;
    budget_amount: number;
  };
}

const METRIC_LABELS: Record<string, { bn: string; unit: string; isCurrency: boolean }> = {
  POSTS_DONE: { bn: 'গ্রুপ পোস্ট সম্পন্ন', unit: 'টি', isCurrency: false },
  SALES_AMOUNT: { bn: 'মোট বিক্রয়', unit: '৳', isCurrency: true },
  PROFIT_AMOUNT: { bn: 'মোট মুনাফা', unit: '৳', isCurrency: true },
  NEW_CLIENTS: { bn: 'নতুন ক্রেতা', unit: 'জন', isCurrency: false },
  B2B_ORDERS: { bn: 'B2B অর্ডার', unit: 'টি', isCurrency: false },
  RETENTION_COUNT: { bn: 'রিটেনশন ও পুনঃসক্রিয়', unit: 'জন', isCurrency: false },
  FOLLOWUPS_DONE: { bn: 'ইনবক্স ফলো-আপ', unit: 'টি', isCurrency: false },
  CONFIRMED_ORDERS: { bn: 'কনফার্মড অর্ডার', unit: 'টি', isCurrency: false },
  NEW_LEADS: { bn: 'নতুন লিড', unit: 'টি', isCurrency: false },
  AD_SPEND: { bn: 'বিজ্ঞাপন খরচ (Ad Spend)', unit: '৳', isCurrency: true },
  B2B_INQUIRIES: { bn: 'B2B ইনকোয়ারি', unit: 'টি', isCurrency: false },
  B2B_INQUIRY_VALUE: { bn: 'B2B ইনকোয়ারি মূল্য', unit: '৳', isCurrency: true },
};

export default function AdminTargetsPage() {
  const [targets, setTargets] = useState<SectionTarget[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignBudgets, setCampaignBudgets] = useState<CampaignBudget[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<{ amount: number } | null>(null);
  const [actualSpend, setActualSpend] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SectionTarget | null>(null);

  // Form states
  const [targetForm, setTargetForm] = useState({
    section_id: '',
    metric_type: 'SALES_AMOUNT',
    target_value: '',
    period_type: 'MONTHLY',
    period_start: new Date().toISOString().slice(0, 7), // YYYY-MM
    period_end: '',
  });

  const [budgetForm, setBudgetForm] = useState({
    scope: 'MONTHLY_TOTAL',
    month: new Date().toISOString().slice(0, 7),
    campaign_id: '',
    amount: '',
  });

  const [copyForm, setCopyForm] = useState({
    copy_type: 'MONTH_TO_MONTH',
    from_month: new Date().toISOString().slice(0, 7),
    to_month: '',
    from_section_id: '',
    to_section_id: '',
    section_id: '',
    copy_budget: true,
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [tRes, sRes, bRes, cRes] = await Promise.all([
        fetch('/api/targets'),
        fetch('/api/admin/sections'),
        fetch(`/api/budgets?month=${currentMonth}`),
        fetch('/api/campaigns'),
      ]);

      if (tRes.ok) {
        const d = await tRes.json();
        setTargets(d.targets || []);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSections(d.sections || []);
        if (d.sections?.length > 0 && !targetForm.section_id) {
          setTargetForm((prev) => ({ ...prev, section_id: d.sections[0].id }));
        }
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setMonthlyBudget(d.monthly_budget);
        setActualSpend(Number(d.actual_spend || 0));
        setCampaignBudgets(d.campaign_budgets || []);
        if (d.monthly_budget) {
          setBudgetForm((prev) => ({ ...prev, amount: String(d.monthly_budget.amount) }));
        }
      }
      if (cRes.ok) {
        const d = await cRes.json();
        setCampaigns(d.campaigns || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [targetForm.section_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live preview calculation for modal
  const livePreview = useMemo(() => {
    const val = parseFloat(targetForm.target_value);
    return calculateTargetLivePreview({
      targetValue: isNaN(val) ? 0 : val,
      periodType: targetForm.period_type,
      periodStart: targetForm.period_start,
      periodEnd: targetForm.period_end,
      metricType: targetForm.metric_type,
    });
  }, [targetForm]);

  // Overlap warning detection
  const overlappingTarget = useMemo(() => {
    if (!targetForm.section_id || !targetForm.metric_type || !targetForm.target_value) return null;
    return findOverlappingTarget(targets, {
      id: editingTarget?.id,
      section_id: targetForm.section_id,
      metric_type: targetForm.metric_type,
      period_type: targetForm.period_type,
      period_start:
        targetForm.period_type === 'MONTHLY'
          ? `${targetForm.period_start}-01`
          : targetForm.period_start,
      period_end: targetForm.period_type === 'CUSTOM' ? targetForm.period_end : null,
    });
  }, [targets, targetForm, editingTarget]);

  // Budget status evaluation (Green < 80%, Yellow 80-100%, Red > 100%)
  const budgetStatus = useMemo(() => {
    return calculateBudgetStatus(monthlyBudget ? Number(monthlyBudget.amount) : 0, actualSpend);
  }, [monthlyBudget, actualSpend]);

  const handleCreateOrUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const val = parseFloat(targetForm.target_value);
      if (isNaN(val) || val <= 0) {
        setErrorMsg('সঠিক পজিটিভ টার্গেট মান দিন।');
        return;
      }

      let pStart = null;
      let pEnd = null;

      if (targetForm.period_type === 'MONTHLY') {
        pStart = `${targetForm.period_start}-01`;
      } else if (targetForm.period_type === 'CUSTOM') {
        pStart = targetForm.period_start;
        pEnd = targetForm.period_end;
        if (!pStart || !pEnd) {
          setErrorMsg('কাস্টম পিরিয়ডের জন্য শুরুর ও শেষের তারিখ দিন।');
          return;
        }
        if (new Date(pStart) > new Date(pEnd)) {
          setErrorMsg('শুরুর তারিখ শেষের তারিখের চেয়ে ছোট বা সমান হতে হবে।');
          return;
        }
      }

      if (editingTarget) {
        const res = await fetch(`/api/targets/${editingTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_value: val,
            period_start: pStart,
            period_end: pEnd,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'আপডেট করতে ব্যর্থ হয়েছে');
        setSuccessMsg('টার্গেট সফলভাবে আপডেট হয়েছে!');
      } else {
        const res = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: targetForm.section_id,
            metric_type: targetForm.metric_type,
            target_value: val,
            period_type: targetForm.period_type,
            period_start: pStart,
            period_end: pEnd,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'টার্গেট তৈরি করতে ব্যর্থ হয়েছে');
        setSuccessMsg('নতুন টার্গেট সফলভাবে সংরক্ষিত হয়েছে!');
      }

      setShowAddModal(false);
      setEditingTarget(null);
      fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('আপনি কি এই টার্গেটটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('ডিলিট ব্যর্থ হয়েছে');
      setSuccessMsg('টার্গেট সফলভাবে মুছে ফেলা হয়েছে!');
      fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const amt = parseFloat(budgetForm.amount);
      if (isNaN(amt) || amt < 0) {
        setErrorMsg('সঠিক বাজেট পরিমাণ লিখুন।');
        return;
      }

      if (budgetForm.scope === 'CAMPAIGN' && !budgetForm.campaign_id) {
        setErrorMsg('একটি নির্দিষ্ট ক্যাম্পেইন নির্বাচন করুন।');
        return;
      }

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: budgetForm.scope,
          month: budgetForm.scope === 'MONTHLY_TOTAL' ? budgetForm.month : undefined,
          campaign_id: budgetForm.scope === 'CAMPAIGN' ? budgetForm.campaign_id : undefined,
          amount: amt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'বাজেট সংরক্ষণ ব্যর্থ');

      setSuccessMsg(
        budgetForm.scope === 'MONTHLY_TOTAL'
          ? 'মাসিক বাজেট সফলভাবে সংরক্ষিত হয়েছে!'
          : 'ক্যাম্পেইন বাজেট সফলভাবে সংরক্ষিত হয়েছে!'
      );
      setShowBudgetModal(false);
      fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    }
  };

  const handleBulkCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const payload: Record<string, unknown> = {
        copy_type: copyForm.copy_type,
      };

      if (copyForm.copy_type === 'MONTH_TO_MONTH') {
        if (!copyForm.to_month) {
          setErrorMsg('গন্তব্য মাস (To Month) নির্বাচন করুন।');
          return;
        }
        payload.from_month = copyForm.from_month;
        payload.to_month = copyForm.to_month;
        if (copyForm.section_id) payload.section_id = copyForm.section_id;
        payload.copy_budget = copyForm.copy_budget;
      } else {
        if (!copyForm.from_section_id || !copyForm.to_section_id) {
          setErrorMsg('উভয় সেকশন নির্বাচন করুন।');
          return;
        }
        if (copyForm.from_section_id === copyForm.to_section_id) {
          setErrorMsg('ভিন্ন ভিন্ন সেকশন নির্বাচন করুন।');
          return;
        }
        payload.from_section_id = copyForm.from_section_id;
        payload.to_section_id = copyForm.to_section_id;
      }

      const res = await fetch('/api/targets/bulk-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'বাল্ক কপি ব্যর্থ');

      setSuccessMsg(data.message || 'টার্গেট সফলভাবে কপি হয়েছে!');
      setShowCopyModal(false);
      fetchData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    }
  };

  const filteredTargets = targets.filter((t) => {
    if (filterSection !== 'ALL' && t.section_id !== filterSection) return false;
    if (filterPeriod !== 'ALL' && t.period_type !== filterPeriod) return false;
    return true;
  });

  const selectedMetric = METRIC_LABELS[targetForm.metric_type] || {
    bn: targetForm.metric_type,
    unit: '',
    isCurrency: false,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            টার্গেট ও বাজেট ব্যবস্থাপনা (Targets & Budgets)
          </h1>
          <p className="text-sm text-slate-500">
            সেকশন ভিত্তিক লক্ষ্যমাত্রা নির্ধারণ, বিজ্ঞাপন বাজেট ট্র্যাকিং ও বাল্ক কপি নিয়ন্ত্রণ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBudgetModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <DollarSign className="h-4 w-4 text-emerald-600" />
            বাজেট নির্ধারণ (Monthly & Campaign)
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Copy className="h-4 w-4 text-blue-600" />
            বাল্ক কপি (Bulk Copy)
          </button>
          <button
            onClick={() => {
              setEditingTarget(null);
              setTargetForm({
                section_id: sections[0]?.id || '',
                metric_type: 'SALES_AMOUNT',
                target_value: '',
                period_type: 'MONTHLY',
                period_start: new Date().toISOString().slice(0, 7),
                period_end: '',
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" />
            নতুন টার্গেট সেট করুন
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3.5 text-xs font-semibold text-red-800 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Monthly Budget Card with dynamic progress: Green <80%, Yellow 80-100%, Red >100% */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              চলতি মাসের মার্কেটিং বাজেট ({new Date().toISOString().slice(0, 7)})
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-2xl font-black text-slate-900">
                {monthlyBudget ? formatTaka(monthlyBudget.amount) : '৳ ০ (সেট করা হয়নি)'}
              </span>
              <span className="text-xs text-slate-500">
                (মোট খরচ: <span className="font-semibold text-slate-800">{formatTaka(actualSpend)}</span>)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                budgetStatus.color === 'emerald'
                  ? 'bg-emerald-100 text-emerald-800'
                  : budgetStatus.color === 'amber'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  budgetStatus.color === 'emerald'
                    ? 'bg-emerald-500'
                    : budgetStatus.color === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
              ></span>
              {budgetStatus.statusLabelBn} ({budgetStatus.spendPercentage}%)
            </span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <span>বিজ্ঞাপন বাজেট খরচ ট্র্যাকিং</span>
              <span className="text-[11px] text-slate-400">
                (বাজেট স্কোরিং মেট্রিক নয় — spend বাড়লে স্কোর বা পয়েন্ট কমে না)
              </span>
            </span>
            <span className="font-semibold text-slate-700">
              {budgetStatus.spendPercentage}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                budgetStatus.color === 'emerald'
                  ? 'bg-emerald-500'
                  : budgetStatus.color === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{
                width: `${monthlyBudget ? Math.min(100, Math.max(3, budgetStatus.spendPercentage)) : 0}%`,
              }}
            ></div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>নিরাপদ সীমা: &lt; ৮০%</span>
            <span>সতর্কবার্তা: ৮০% - ১০০%</span>
            <span>সীমা অতিক্রান্ত: &gt; ১০০%</span>
          </div>
        </div>

        {/* Campaign Budgets Overview if any */}
        {campaignBudgets.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700 mb-2">ক্যাম্পেইন বাজেট ওভারভিউ:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {campaignBudgets.map((cb) => (
                <div key={cb.id} className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-800 truncate">
                    {cb.campaign?.name || 'ক্যাম্পেইন'}
                  </div>
                  <div className="text-slate-500 text-[11px] flex justify-between mt-1">
                    <span>বাজেট: {formatTaka(cb.amount)}</span>
                    <span className="text-emerald-600 font-medium">{cb.campaign?.channel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Targets Table & Filter */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Target className="h-4 w-4 text-emerald-600" />
            সেকশন টার্গেট তালিকা ({filteredTargets.length})
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="h-3.5 w-3.5" />
              <span>সেকশন:</span>
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">সব সেকশন</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>মেয়াদ:</span>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">সব মেয়াদ</option>
                <option value="MONTHLY">মাসিক (Monthly)</option>
                <option value="DAILY">দৈনিক (Daily)</option>
                <option value="CUSTOM">কাস্টম (Custom)</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">ডাটা লোড হচ্ছে...</div>
        ) : filteredTargets.length === 0 ? (
          <div className="p-8 text-center">
            <Target className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">কোনো টার্গেট সেট করা নেই</p>
            <p className="text-xs text-slate-500 mt-1">
              উপরে &quot;নতুন টার্গেট সেট করুন&quot; বোতাম ক্লিক করে সেকশনের টার্গেট নির্ধারণ করুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">সেকশন</th>
                  <th className="px-4 py-3">মেট্রিক টাইপ</th>
                  <th className="px-4 py-3">লক্ষ্যমাত্রা (Target Value)</th>
                  <th className="px-4 py-3">মেয়াদ (Period)</th>
                  <th className="px-4 py-3">সময়সীমা</th>
                  <th className="px-4 py-3">সেট করেছেন</th>
                  <th className="px-4 py-3 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTargets.map((t) => {
                  const metricInfo = METRIC_LABELS[t.metric_type] || {
                    bn: t.metric_type,
                    unit: '',
                    isCurrency: false,
                  };

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {t.section.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-medium text-slate-800">{metricInfo.bn}</span>
                        <span className="block text-[10px] text-slate-400">{t.metric_type}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {metricInfo.isCurrency
                          ? formatTaka(t.target_value)
                          : `${Number(t.target_value).toLocaleString()} ${metricInfo.unit}`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                            t.period_type === 'MONTHLY'
                              ? 'bg-blue-50 text-blue-700'
                              : t.period_type === 'DAILY'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {t.period_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {t.period_type === 'DAILY' && 'প্রতিদিন'}
                        {t.period_type === 'MONTHLY' &&
                          t.period_start &&
                          new Date(t.period_start).toISOString().slice(0, 7)}
                        {t.period_type === 'CUSTOM' &&
                          `${t.period_start?.slice(0, 10)} হতে ${t.period_end?.slice(0, 10)}`}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {t.creator.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingTarget(t);
                              setTargetForm({
                                section_id: t.section_id,
                                metric_type: t.metric_type,
                                target_value: String(t.target_value),
                                period_type: t.period_type,
                                period_start: t.period_start
                                  ? t.period_type === 'MONTHLY'
                                    ? t.period_start.slice(0, 7)
                                    : t.period_start.slice(0, 10)
                                  : '',
                                period_end: t.period_end ? t.period_end.slice(0, 10) : '',
                              });
                              setShowAddModal(true);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-emerald-700 hover:bg-slate-100"
                            title="সম্পাদনা"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTarget(t.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-red-50"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">
              {editingTarget ? 'টার্গেট সম্পাদনা করুন' : 'নতুন টার্গেট নির্ধারণ করুন'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              সেকশন ও মেট্রিক নির্বাচন করে লক্ষ্যমাত্রা নির্ধারণ করুন।
            </p>

            {/* Overlap Warning Alert */}
            {overlappingTarget && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800 border border-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-900">ওভারল্যাপ সতর্কতা (Overlap Warning)</div>
                  <div>
                    এই সেকশন ও মেট্রিকের জন্য ইতিমধ্যে একটি{' '}
                    <span className="font-semibold">{overlappingTarget.period_type}</span> টার্গেট বিদ্যমান।
                    নির্দিষ্টতার নিয়ম অনুসারে (CUSTOM &gt; MONTHLY &gt; DAILY) অগ্রাধিকার নির্ধারিত হবে।
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateTarget} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">গ্রুপ সেকশন</label>
                <select
                  disabled={!!editingTarget}
                  value={targetForm.section_id}
                  onChange={(e) => setTargetForm({ ...targetForm, section_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">মেট্রিক টাইপ</label>
                <select
                  disabled={!!editingTarget}
                  value={targetForm.metric_type}
                  onChange={(e) => setTargetForm({ ...targetForm, metric_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(METRIC_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.bn} ({k})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">লক্ষ্যমাত্রা মান (Target Value)</label>
                <input
                  type="number"
                  step="any"
                  value={targetForm.target_value}
                  onChange={(e) => setTargetForm({ ...targetForm, target_value: e.target.value })}
                  placeholder="যেমন: 50000 বা 100"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">মেয়াদের ধরন (Period Type)</label>
                <select
                  disabled={!!editingTarget}
                  value={targetForm.period_type}
                  onChange={(e) => setTargetForm({ ...targetForm, period_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="MONTHLY">মাসিক (Monthly)</option>
                  <option value="DAILY">দৈনিক (Daily)</option>
                  <option value="CUSTOM">কাস্টম নির্দিষ্ট তারিখ রেঞ্জ (Custom)</option>
                </select>
              </div>

              {targetForm.period_type === 'MONTHLY' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">মাস (YYYY-MM)</label>
                  <input
                    type="month"
                    value={targetForm.period_start}
                    onChange={(e) => setTargetForm({ ...targetForm, period_start: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              {targetForm.period_type === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">শুরুর তারিখ</label>
                    <input
                      type="date"
                      value={targetForm.period_start}
                      onChange={(e) => setTargetForm({ ...targetForm, period_start: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">শেষের তারিখ</label>
                    <input
                      type="date"
                      value={targetForm.period_end}
                      onChange={(e) => setTargetForm({ ...targetForm, period_end: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Live Preview Display: "প্রতিদিন X, মোট Y" */}
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>লাইভ ক্যালকুলেশন প্রিভিউ:</span>
                </div>
                <div className="mt-1 text-sm font-black text-emerald-800">
                  {livePreview.previewText}
                  {selectedMetric.isCurrency ? ' ৳' : ` ${selectedMetric.unit}`}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">
                  ({livePreview.days} দিনের হিসাব, দৈনিক গড়: {livePreview.dailyRate}
                  {selectedMetric.isCurrency ? ' ৳' : ` ${selectedMetric.unit}`})
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTarget(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal supporting MONTHLY_TOTAL and CAMPAIGN scopes */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">বিজ্ঞাপন ও মার্কেটিং বাজেট নির্ধারণ</h2>
            <p className="text-xs text-slate-500 mb-4">
              মাসিক মোট বাজেট অথবা নির্দিষ্ট ক্যাম্পেইনের বাজেট লিমিট নির্ধারণ করুন।
            </p>

            <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">বাজেট স্কোপ (Scope)</label>
                <select
                  value={budgetForm.scope}
                  onChange={(e) => setBudgetForm({ ...budgetForm, scope: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="MONTHLY_TOTAL">মাসিক মোট বাজেট (Monthly Total)</option>
                  <option value="CAMPAIGN">ক্যাম্পেইন বাজেট (Campaign)</option>
                </select>
              </div>

              {budgetForm.scope === 'MONTHLY_TOTAL' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">মাস (Month)</label>
                  <input
                    type="month"
                    value={budgetForm.month}
                    onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ক্যাম্পেইন নির্বাচন করুন</label>
                  <select
                    value={budgetForm.campaign_id}
                    onChange={(e) => setBudgetForm({ ...budgetForm, campaign_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                    required
                  >
                    <option value="">ক্যাম্পেইন বেছে নিন</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.channel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">বাজেট পরিমাণ (৳)</label>
                <input
                  type="number"
                  step="any"
                  value={budgetForm.amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                  placeholder="যেমন: 50000"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>বিজ্ঞাপন বাজেট কোনো স্কোরিং মেট্রিক নয় — spend কম বা বেশি হলেও এমপ্লয়ী পয়েন্ট কমবে না।</span>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  বাজেট সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Copy Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-1">বাল্ক কপি (Bulk Copy Targets & Budgets)</h2>
            <p className="text-xs text-slate-500 mb-4">
              এক মাসের টার্গেট/বাজেট পরবর্তী মাসে অথবা এক সেকশনের টার্গেট অন্য সেকশনে দ্রুত কপি করুন।
            </p>

            <form onSubmit={handleBulkCopy} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">কপি টাইপ</label>
                <select
                  value={copyForm.copy_type}
                  onChange={(e) => setCopyForm({ ...copyForm, copy_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="MONTH_TO_MONTH">মাস থেকে পরবর্তী মাস (Month to Month)</option>
                  <option value="SECTION_TO_SECTION">সেকশন থেকে অন্য সেকশন (Section to Section)</option>
                </select>
              </div>

              {copyForm.copy_type === 'MONTH_TO_MONTH' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">যে মাস থেকে (From)</label>
                      <input
                        type="month"
                        value={copyForm.from_month}
                        onChange={(e) => setCopyForm({ ...copyForm, from_month: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">যে মাসে কপি হবে (To)</label>
                      <input
                        type="month"
                        value={copyForm.to_month}
                        onChange={(e) => setCopyForm({ ...copyForm, to_month: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">নির্দিষ্ট সেকশন (ঐচ্ছিক)</label>
                    <select
                      value={copyForm.section_id}
                      onChange={(e) => setCopyForm({ ...copyForm, section_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                    >
                      <option value="">সব সেকশনের টার্গেট কপি করুন</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="copy_budget_cb"
                      checked={copyForm.copy_budget}
                      onChange={(e) => setCopyForm({ ...copyForm, copy_budget: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="copy_budget_cb" className="font-medium text-slate-700">
                      মাসিক বাজেটও একসাথে পরবর্তী মাসে কপি করুন
                    </label>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">উৎস সেকশন (From Section)</label>
                    <select
                      value={copyForm.from_section_id}
                      onChange={(e) => setCopyForm({ ...copyForm, from_section_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                      required
                    >
                      <option value="">উৎস সেকশন নির্বাচন করুন</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">গন্তব্য সেকশন (To Section)</label>
                    <select
                      value={copyForm.to_section_id}
                      onChange={(e) => setCopyForm({ ...copyForm, to_section_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                      required
                    >
                      <option value="">গন্তব্য সেকশন নির্বাচন করুন</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  কপি সম্পন্ন করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
