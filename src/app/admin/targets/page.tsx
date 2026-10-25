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
  TrendingUp,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
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
  AD_SPEND: { bn: 'বিজ্ঞাপন খরচ', unit: '৳', isCurrency: true },
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

  const budgetTone =
    budgetStatus.color === 'emerald' ? 'green' : budgetStatus.color === 'amber' ? 'amber' : 'red';
  const budgetBar =
    budgetStatus.color === 'emerald' ? 'bg-emerald-500' : budgetStatus.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500';

  const sectionOptions = sections.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));

  const modalFooter = (onCancel: () => void, submitLabel: string) => (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
      <button type="button" onClick={onCancel} className="btn btn-secondary">
        বাতিল · Cancel
      </button>
      <button type="submit" className="btn btn-primary">
        {submitLabel}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Target className="h-5 w-5" />}
        title="টার্গেট ও বাজেট · Targets & budgets"
        subtitle="Section targets, ad budget tracking and bulk copy"
        actions={
          <>
            <button onClick={() => setShowBudgetModal(true)} className="btn btn-secondary">
              <DollarSign className="h-4 w-4" />
              বাজেট · Budget
            </button>
            <button onClick={() => setShowCopyModal(true)} className="btn btn-secondary">
              <Copy className="h-4 w-4" />
              বাল্ক কপি · Bulk copy
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
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              নতুন টার্গেট · New target
            </button>
          </>
        }
      />

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Monthly Budget Card: Green <80%, Amber 80-100%, Red >100% */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">মাসিক বিজ্ঞাপন বাজেট · Monthly ad budget</h2>
            <p className="card-subtitle">{new Date().toISOString().slice(0, 7)} · not a scoring metric</p>
          </div>
          <span className={`badge badge-${budgetTone}`}>
            {budgetStatus.statusLabelBn} · {budgetStatus.spendPercentage}%
          </span>
        </div>
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <div>
              <p className="text-xs text-slate-500">বাজেট · Budget</p>
              <p className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                {monthlyBudget ? formatTaka(monthlyBudget.amount) : '—'}
              </p>
              {!monthlyBudget && <p className="hint">সেট করা হয়নি · Not set</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">খরচ · Spent</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatTaka(actualSpend)}</p>
            </div>
          </div>

          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${budgetBar}`}
                style={{
                  width: `${monthlyBudget ? Math.min(100, Math.max(3, budgetStatus.spendPercentage)) : 0}%`,
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>&lt; 80% OK</span>
              <span>80–100% Warning</span>
              <span>&gt; 100% Over</span>
            </div>
          </div>

          {campaignBudgets.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-700">ক্যাম্পেইন বাজেট · Campaign budgets</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaignBudgets.map((cb) => (
                  <div key={cb.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="truncate font-medium text-slate-900">{cb.campaign?.name || 'ক্যাম্পেইন'}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-slate-500">
                      <span className="tabular-nums">{formatTaka(cb.amount)}</span>
                      {cb.campaign?.channel && <span className="badge badge-gray">{cb.campaign.channel}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Targets Table & Filter */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">সেকশন টার্গেট · Section targets</h2>
            <p className="card-subtitle">{filteredTargets.length} shown</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="filter_section" className="sr-only">Section</label>
            <select
              id="filter_section"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="input w-full py-1.5 text-xs sm:w-auto"
            >
              <option value="ALL">সব সেকশন · All sections</option>
              {sectionOptions}
            </select>
            <label htmlFor="filter_period" className="sr-only">Period</label>
            <select
              id="filter_period"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="input w-full py-1.5 text-xs sm:w-auto"
            >
              <option value="ALL">সব মেয়াদ · All periods</option>
              <option value="MONTHLY">মাসিক · Monthly</option>
              <option value="DAILY">দৈনিক · Daily</option>
              <option value="CUSTOM">কাস্টম · Custom</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              লোড হচ্ছে · Loading…
            </div>
          ) : filteredTargets.length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="কোনো টার্গেট নেই · No targets yet"
              description="Use “New target” to set a goal for a section."
            />
          ) : (
            <table className="table-pro">
              <thead>
                <tr>
                  <th>সেকশন · Section</th>
                  <th>মেট্রিক · Metric</th>
                  <th className="text-right">লক্ষ্য · Target</th>
                  <th>মেয়াদ · Period</th>
                  <th>সময় · Dates</th>
                  <th>সেট করেছেন · By</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map((t) => {
                  const metricInfo = METRIC_LABELS[t.metric_type] || {
                    bn: t.metric_type,
                    unit: '',
                    isCurrency: false,
                  };

                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap font-medium text-slate-900">{t.section.name}</td>
                      <td className="min-w-[150px]">
                        <div className="text-slate-900">{metricInfo.bn}</div>
                        <div className="text-[11px] text-slate-400">{t.metric_type}</div>
                      </td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums text-slate-900">
                        {metricInfo.isCurrency
                          ? formatTaka(t.target_value)
                          : `${Number(t.target_value).toLocaleString()} ${metricInfo.unit}`}
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`badge ${
                            t.period_type === 'MONTHLY'
                              ? 'badge-blue'
                              : t.period_type === 'DAILY'
                              ? 'badge-amber'
                              : 'badge-violet'
                          }`}
                        >
                          {t.period_type === 'MONTHLY' ? 'Monthly' : t.period_type === 'DAILY' ? 'Daily' : t.period_type === 'CUSTOM' ? 'Custom' : t.period_type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-slate-500 tabular-nums">
                        {t.period_type === 'DAILY' && 'প্রতিদিন · Every day'}
                        {t.period_type === 'MONTHLY' &&
                          t.period_start &&
                          new Date(t.period_start).toISOString().slice(0, 7)}
                        {t.period_type === 'CUSTOM' &&
                          `${t.period_start?.slice(0, 10)} – ${t.period_end?.slice(0, 10)}`}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{t.creator.name}</td>
                      <td className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
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
                            className="btn-icon"
                            aria-label="Edit target"
                            title="সম্পাদনা · Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTarget(t.id)}
                            className="btn-icon hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete target"
                            title="মুছুন · Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Target Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h2 className="card-title">
                {editingTarget ? 'টার্গেট সম্পাদনা · Edit target' : 'নতুন টার্গেট · New target'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTarget(null);
                }}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateTarget}>
              <div className="card-body space-y-4">
                {overlappingTarget && (
                  <div className="alert alert-warning">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium">ওভারল্যাপ · Overlap</p>
                      <p className="mt-0.5">
                        A <span className="font-medium">{overlappingTarget.period_type}</span> target already exists
                        for this section and metric. Priority: CUSTOM &gt; MONTHLY &gt; DAILY.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="t_section">সেকশন · Section</label>
                  <select
                    id="t_section"
                    disabled={!!editingTarget}
                    value={targetForm.section_id}
                    onChange={(e) => setTargetForm({ ...targetForm, section_id: e.target.value })}
                    className="input"
                    required
                  >
                    {sectionOptions}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="t_metric">মেট্রিক · Metric</label>
                  <select
                    id="t_metric"
                    disabled={!!editingTarget}
                    value={targetForm.metric_type}
                    onChange={(e) => setTargetForm({ ...targetForm, metric_type: e.target.value })}
                    className="input"
                  >
                    {Object.entries(METRIC_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.bn} · {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="t_value">লক্ষ্য · Target value</label>
                    <input
                      id="t_value"
                      type="number"
                      step="any"
                      value={targetForm.target_value}
                      onChange={(e) => setTargetForm({ ...targetForm, target_value: e.target.value })}
                      placeholder="50000"
                      className="input tabular-nums"
                      required
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="t_period">মেয়াদ · Period</label>
                    <select
                      id="t_period"
                      disabled={!!editingTarget}
                      value={targetForm.period_type}
                      onChange={(e) => setTargetForm({ ...targetForm, period_type: e.target.value })}
                      className="input"
                    >
                      <option value="MONTHLY">মাসিক · Monthly</option>
                      <option value="DAILY">দৈনিক · Daily</option>
                      <option value="CUSTOM">কাস্টম · Custom range</option>
                    </select>
                  </div>
                </div>

                {targetForm.period_type === 'MONTHLY' && (
                  <div>
                    <label className="label" htmlFor="t_month">মাস · Month</label>
                    <input
                      id="t_month"
                      type="month"
                      value={targetForm.period_start}
                      onChange={(e) => setTargetForm({ ...targetForm, period_start: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                )}

                {targetForm.period_type === 'CUSTOM' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="t_start">শুরু · Start</label>
                      <input
                        id="t_start"
                        type="date"
                        value={targetForm.period_start}
                        onChange={(e) => setTargetForm({ ...targetForm, period_start: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="t_end">শেষ · End</label>
                      <input
                        id="t_end"
                        type="date"
                        value={targetForm.period_end}
                        onChange={(e) => setTargetForm({ ...targetForm, period_end: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Live Preview: "প্রতিদিন X, মোট Y" */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" />
                    প্রিভিউ · Preview
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {livePreview.previewText}
                    {selectedMetric.isCurrency ? ' ৳' : ` ${selectedMetric.unit}`}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {livePreview.days} দিন · daily avg {livePreview.dailyRate}
                    {selectedMetric.isCurrency ? ' ৳' : ` ${selectedMetric.unit}`}
                  </div>
                </div>
              </div>

              {modalFooter(() => {
                setShowAddModal(false);
                setEditingTarget(null);
              }, 'সংরক্ষণ · Save')}
            </form>
          </div>
        </div>
      )}

      {/* Budget Modal supporting MONTHLY_TOTAL and CAMPAIGN scopes */}
      {showBudgetModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h2 className="card-title">বাজেট নির্ধারণ · Set budget</h2>
              <button type="button" onClick={() => setShowBudgetModal(false)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBudget}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="b_scope">ধরন · Scope</label>
                  <select
                    id="b_scope"
                    value={budgetForm.scope}
                    onChange={(e) => setBudgetForm({ ...budgetForm, scope: e.target.value })}
                    className="input"
                  >
                    <option value="MONTHLY_TOTAL">মাসিক মোট · Monthly total</option>
                    <option value="CAMPAIGN">ক্যাম্পেইন · Campaign</option>
                  </select>
                </div>

                {budgetForm.scope === 'MONTHLY_TOTAL' ? (
                  <div>
                    <label className="label" htmlFor="b_month">মাস · Month</label>
                    <input
                      id="b_month"
                      type="month"
                      value={budgetForm.month}
                      onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="label" htmlFor="b_campaign">ক্যাম্পেইন · Campaign</label>
                    <select
                      id="b_campaign"
                      value={budgetForm.campaign_id}
                      onChange={(e) => setBudgetForm({ ...budgetForm, campaign_id: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">বেছে নিন · Select</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.channel})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="b_amount">পরিমাণ · Amount (৳)</label>
                  <input
                    id="b_amount"
                    type="number"
                    step="any"
                    value={budgetForm.amount}
                    onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                    placeholder="50000"
                    className="input tabular-nums"
                    required
                  />
                  <p className="hint flex items-start gap-1">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    Ad budget does not affect employee points.
                  </p>
                </div>
              </div>

              {modalFooter(() => setShowBudgetModal(false), 'সংরক্ষণ · Save budget')}
            </form>
          </div>
        </div>
      )}

      {/* Bulk Copy Modal */}
      {showCopyModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div>
                <h2 className="card-title">বাল্ক কপি · Bulk copy</h2>
                <p className="card-subtitle">Copy targets to another month or section</p>
              </div>
              <button type="button" onClick={() => setShowCopyModal(false)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBulkCopy}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="c_type">কপি ধরন · Copy type</label>
                  <select
                    id="c_type"
                    value={copyForm.copy_type}
                    onChange={(e) => setCopyForm({ ...copyForm, copy_type: e.target.value })}
                    className="input"
                  >
                    <option value="MONTH_TO_MONTH">মাস → মাস · Month to month</option>
                    <option value="SECTION_TO_SECTION">সেকশন → সেকশন · Section to section</option>
                  </select>
                </div>

                {copyForm.copy_type === 'MONTH_TO_MONTH' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label" htmlFor="c_from">থেকে · From</label>
                        <input
                          id="c_from"
                          type="month"
                          value={copyForm.from_month}
                          onChange={(e) => setCopyForm({ ...copyForm, from_month: e.target.value })}
                          className="input"
                          required
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="c_to">পর্যন্ত · To</label>
                        <input
                          id="c_to"
                          type="month"
                          value={copyForm.to_month}
                          onChange={(e) => setCopyForm({ ...copyForm, to_month: e.target.value })}
                          className="input"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label" htmlFor="c_section">সেকশন · Section</label>
                      <select
                        id="c_section"
                        value={copyForm.section_id}
                        onChange={(e) => setCopyForm({ ...copyForm, section_id: e.target.value })}
                        className="input"
                      >
                        <option value="">সব সেকশন · All sections</option>
                        {sectionOptions}
                      </select>
                    </div>

                    <label htmlFor="copy_budget_cb" className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        id="copy_budget_cb"
                        checked={copyForm.copy_budget}
                        onChange={(e) => setCopyForm({ ...copyForm, copy_budget: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      মাসিক বাজেটও কপি · Also copy monthly budget
                    </label>
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="c_from_section">উৎস · From section</label>
                      <select
                        id="c_from_section"
                        value={copyForm.from_section_id}
                        onChange={(e) => setCopyForm({ ...copyForm, from_section_id: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">বেছে নিন · Select</option>
                        {sectionOptions}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="c_to_section">গন্তব্য · To section</label>
                      <select
                        id="c_to_section"
                        value={copyForm.to_section_id}
                        onChange={(e) => setCopyForm({ ...copyForm, to_section_id: e.target.value })}
                        className="input"
                        required
                      >
                        <option value="">বেছে নিন · Select</option>
                        {sectionOptions}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {modalFooter(() => setShowCopyModal(false), 'কপি করুন · Copy')}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
