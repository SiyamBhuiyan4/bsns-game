'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Package,
  TrendingUp,
  DollarSign,
  PieChart,
  ShieldAlert,
  Edit2,
  X,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { format } from 'date-fns';

interface ProductRef {
  id: string;
  name_bn: string;
}

interface CampaignItem {
  id: string;
  name: string;
  channel: 'FACEBOOK_GROUP' | 'FACEBOOK_AD' | 'GOOGLE_AD' | 'YOUTUBE' | 'OTHER';
  product: ProductRef | null;
  budget_amount: number;
  budget_limit?: number;
  spend: number;
  spend_percentage: number;
  revenue: number;
  roas: number;
  budget_status: 'SAFE' | 'WARNING' | 'EXCEEDED';
  warning_message: string | null;
  status: 'PLANNED' | 'RUNNING' | 'PAUSED' | 'ENDED';
  start_date: string;
  end_date: string | null;
  leads_count: number;
  orders_count?: number;
}

interface SummaryData {
  total_campaigns: number;
  active_campaigns: number;
  total_budget: number;
  total_spend: number;
  total_revenue: number;
  overall_roas: number;
  campaigns_at_risk: number;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Add Campaign Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<CampaignItem['channel']>('FACEBOOK_AD');
  const [productId, setProductId] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<CampaignItem['status']>('RUNNING');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Deep link from the assistant: ?add=1 opens the add form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') setIsAddOpen(true);
  }, []);

  // Edit / Quick Update Modal
  const [editingCampaign, setEditingCampaign] = useState<CampaignItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editChannel, setEditChannel] = useState<CampaignItem['channel']>('FACEBOOK_AD');
  const [editBudget, setEditBudget] = useState('');
  const [editStatus, setEditStatus] = useState<CampaignItem['status']>('RUNNING');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (res.ok) {
        setCampaigns(data.campaigns || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        setErrorMessage(data.error || 'ক্যাম্পেইন লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchProducts();
  }, [fetchCampaigns]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          channel,
          product_id: productId || null,
          budget_amount: parseFloat(budget) || 0,
          start_date: startDate,
          end_date: endDate || null,
          status,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('নতুন মার্কেটিং ক্যাম্পেইন তৈরি হয়েছে');
        setIsAddOpen(false);
        setName('');
        setBudget('');
        fetchCampaigns();
      } else {
        setErrorMessage(data.error || 'ক্যাম্পেইন তৈরি ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleOpenEdit = (c: CampaignItem) => {
    setEditingCampaign(c);
    setEditName(c.name);
    setEditChannel(c.channel);
    setEditBudget(String(c.budget_amount));
    setEditStatus(c.status);
    setErrorMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    setEditSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCampaign.id,
          name: editName,
          channel: editChannel,
          budget_amount: parseFloat(editBudget) || 0,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('ক্যাম্পেইনের তথ্য ও বাজেট সফলভাবে আপডেট করা হয়েছে');
        setEditingCampaign(null);
        fetchCampaigns();
      } else {
        setErrorMessage(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setEditSubmitting(false);
    }
  };

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'FACEBOOK_GROUP':
        return (
          <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold">
            ফেসবুক গ্রুপ (FB Group)
          </span>
        );
      case 'FACEBOOK_AD':
        return (
          <span className="rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold">
            ফেসবুক বিজ্ঞাপন (FB Ad)
          </span>
        );
      case 'GOOGLE_AD':
        return (
          <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
            গুগল বিজ্ঞাপন (Google Ad)
          </span>
        );
      case 'YOUTUBE':
        return (
          <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold">
            ইউটিউব (YouTube)
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold">
            অন্যান্য (Other)
          </span>
        );
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'RUNNING':
        return (
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            চলমান (Running)
          </span>
        );
      case 'PLANNED':
        return <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-bold">পরিকল্পিত (Planned)</span>;
      case 'PAUSED':
        return <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-bold">স্থগিত (Paused)</span>;
      case 'ENDED':
        return <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-bold">সমাপ্ত (Ended)</span>;
      default:
        return null;
    }
  };

  const getBudgetStatusBadge = (status: 'SAFE' | 'WARNING' | 'EXCEEDED', pct: number) => {
    switch (status) {
      case 'EXCEEDED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-200">
            <ShieldAlert className="h-3 w-3 text-rose-600" />
            অতিক্রান্ত ({pct}%)
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600" />
            সতর্কতা ({pct}%)
          </span>
        );
      case 'SAFE':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            নিরাপদ ({pct}%)
          </span>
        );
    }
  };

  const getRoasBadge = (roas: number) => {
    if (roas >= 3.0) {
      return (
        <span className="inline-flex items-center rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-mono font-bold text-emerald-800">
          {roas.toFixed(2)}x
        </span>
      );
    }
    if (roas >= 1.5) {
      return (
        <span className="inline-flex items-center rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-mono font-bold text-blue-800">
          {roas.toFixed(2)}x
        </span>
      );
    }
    if (roas > 0) {
      return (
        <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-mono font-bold text-amber-800">
          {roas.toFixed(2)}x
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
        0.00x
      </span>
    );
  };

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchChannel = selectedChannel === 'ALL' || c.channel === selectedChannel;
      const matchStatus = selectedStatus === 'ALL' || c.status === selectedStatus;
      return matchChannel && matchStatus;
    });
  }, [campaigns, selectedChannel, selectedStatus]);

  // Campaigns that are approaching or exceeding budget
  const alertCampaigns = useMemo(() => {
    return campaigns.filter((c) => c.budget_status === 'WARNING' || c.budget_status === 'EXCEEDED');
  }, [campaigns]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-emerald-600" />
            মার্কেটিং ক্যাম্পেইন ও বাজেট ব্যবস্থাপনা (Campaigns & Budget ROAS)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            ফেসবুক অ্যাড, গ্রুপ, গুগল ও ইউটিউব ক্যাম্পেইনের বাজেট সীমা, অ্যাড স্পেন্ড এবং ROAS (Revenue / Ad Spend) পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setErrorMessage(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন ক্যাম্পেইন তৈরি করুন</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Budget Limit Warnings Banner */}
      {alertCampaigns.length > 0 && (
        <div
          className={`rounded-xl border p-4 shadow-xs ${
            alertCampaigns.some((c) => c.budget_status === 'EXCEEDED')
              ? 'border-rose-300 bg-rose-50/90 text-rose-900'
              : 'border-amber-300 bg-amber-50/90 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {alertCampaigns.some((c) => c.budget_status === 'EXCEEDED') ? (
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="text-sm font-bold">
                বাজেট সীমা সতর্কতা (Budget Limit Alerts) — {alertCampaigns.length} টি ক্যাম্পেইনে খরচ বাজেট স্পর্শ করেছে বা অতিক্রম করেছে!
              </h4>
              <div className="mt-2 space-y-1 text-xs">
                {alertCampaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="font-semibold">• {c.name}:</span>
                    <span
                      className={
                        c.budget_status === 'EXCEEDED'
                          ? 'text-rose-700 font-bold'
                          : 'text-amber-800 font-medium'
                      }
                    >
                      {c.warning_message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6 KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Campaigns */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">মোট ক্যাম্পেইন</span>
              <Megaphone className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-slate-900">{summary.total_campaigns}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total Campaigns</div>
          </div>

          {/* 2. Active Campaigns */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">সক্রিয় ক্যাম্পেইন</span>
              <Zap className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-600">{summary.active_campaigns}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Active (Running)
            </div>
          </div>

          {/* 3. Total Budget */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">মোট বাজেট</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ৳ {summary.total_budget.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total Budget</div>
          </div>

          {/* 4. Ad Spend */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">অ্যাড স্পেন্ড</span>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              ৳ {summary.total_spend.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {summary.total_budget > 0 ? ((summary.total_spend / summary.total_budget) * 100).toFixed(1) : 0}% বাজেট ব্যবহৃত
            </div>
          </div>

          {/* 5. Revenue */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">মোট রাজস্ব</span>
              <Package className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600">
              ৳ {summary.total_revenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total Revenue</div>
          </div>

          {/* 6. Overall ROAS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold">সামগ্রিক ROAS</span>
              <PieChart className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {summary.overall_roas.toFixed(2)}x
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Revenue / Ad Spend</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">চ্যানেল ফিল্টার:</span>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="rounded-xl border border-slate-300 py-1.5 px-3 text-xs bg-white text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল চ্যানেল (All Channels)</option>
              <option value="FACEBOOK_AD">ফেসবুক বিজ্ঞাপন (Facebook Ad)</option>
              <option value="FACEBOOK_GROUP">ফেসবুক গ্রুপ (Facebook Group)</option>
              <option value="GOOGLE_AD">গুগল বিজ্ঞাপন (Google Ad)</option>
              <option value="YOUTUBE">ইউটিউব (YouTube)</option>
              <option value="OTHER">অন্যান্য (Other)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">স্ট্যাটাস:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-300 py-1.5 px-3 text-xs bg-white text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল স্ট্যাটাস (All)</option>
              <option value="RUNNING">চলমান (Running)</option>
              <option value="PLANNED">পরিকল্পিত (Planned)</option>
              <option value="PAUSED">স্থগিত (Paused)</option>
              <option value="ENDED">সমাপ্ত (Ended)</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          মোট দেখানো হচ্ছে: {filteredCampaigns.length} টি
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">ক্যাম্পেইন লোড হচ্ছে...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Megaphone className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো ক্যাম্পেইন পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">ক্যাম্পেইনের নাম</th>
                  <th className="py-3 px-3">চ্যানেল</th>
                  <th className="py-3 px-3">পণ্য</th>
                  <th className="py-3 px-3 text-right">বাজেট সীমা</th>
                  <th className="py-3 px-3 text-right">অ্যাড স্পেন্ড</th>
                  <th className="py-3 px-3 text-right">রাজস্ব (Revenue)</th>
                  <th className="py-3 px-3 text-center">ROAS</th>
                  <th className="py-3 px-3 text-center">লিড / অর্ডার</th>
                  <th className="py-3 px-3 text-center">বাজেট স্থিতি</th>
                  <th className="py-3 px-3 text-center">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(c.start_date), 'dd MMM yyyy')}</span>
                        {c.end_date && <span> - {format(new Date(c.end_date), 'dd MMM yyyy')}</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getChannelBadge(c.channel)}
                    </td>

                    <td className="py-3.5 px-3 text-xs text-slate-700 whitespace-nowrap">
                      {c.product ? (
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-emerald-600" />
                          {c.product.name_bn}
                        </span>
                      ) : (
                        <span className="text-slate-400">সকল পণ্য</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ৳ {c.budget_amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-900">
                        ৳ {c.spend.toLocaleString('en-IN')}
                      </div>
                      <div className="w-24 ml-auto bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            c.budget_status === 'EXCEEDED'
                              ? 'bg-rose-500'
                              : c.budget_status === 'WARNING'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(c.spend_percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {c.spend_percentage}%
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      ৳ {c.revenue.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {getRoasBadge(c.roas)}
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800">
                        {c.leads_count} লিড
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {c.orders_count || 0} অর্ডার
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {getBudgetStatusBadge(c.budget_status, c.spend_percentage)}
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(c.status)}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="বাজেট বা স্ট্যাটাস আপডেট করুন"
                      >
                        <Edit2 className="h-3 w-3 text-slate-500" />
                        <span>সম্পাদনা</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Campaign */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900">নতুন মার্কেটিং ক্যাম্পেইন তৈরি করুন</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Create Marketing Campaign & Allocate Budget</p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্যাম্পেইনের নাম *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মাশরুম পাইকারি বিক্রি বুস্ট (Dhaka)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মার্কেটিং চ্যানেল *
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as CampaignItem['channel'])}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="FACEBOOK_AD">ফেসবুক বিজ্ঞাপন (Facebook Ad)</option>
                    <option value="FACEBOOK_GROUP">ফেসবুক গ্রুপ (Facebook Group)</option>
                    <option value="GOOGLE_AD">গুগল বিজ্ঞাপন (Google Ad)</option>
                    <option value="YOUTUBE">ইউটিউব (YouTube)</option>
                    <option value="OTHER">অন্যান্য (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    নির্দিষ্ট পণ্য (ঐচ্ছিক)
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">সকল পণ্য (General)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_bn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বাজেট সীমা (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="15000.00"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    স্ট্যাটাস *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CampaignItem['status'])}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="RUNNING">চলমান (Running)</option>
                    <option value="PLANNED">পরিকল্পিত (Planned)</option>
                    <option value="PAUSED">স্থগিত (Paused)</option>
                    <option value="ENDED">সমাপ্ত (Ended)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    শুরুর তারিখ *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সমাপ্তির তারিখ (ঐচ্ছিক)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {addSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  সংরক্ষণ করুন (Create)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Campaign Budget & Status */}
      {editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900">ক্যাম্পেইন আপডেট করুন</h3>
              <button onClick={() => setEditingCampaign(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">{editingCampaign.name}</p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্যাম্পেইনের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মার্কেটিং চ্যানেল *
                </label>
                <select
                  value={editChannel}
                  onChange={(e) => setEditChannel(e.target.value as CampaignItem['channel'])}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  <option value="FACEBOOK_AD">ফেসবুক বিজ্ঞাপন (Facebook Ad)</option>
                  <option value="FACEBOOK_GROUP">ফেসবুক গ্রুপ (Facebook Group)</option>
                  <option value="GOOGLE_AD">গুগল বিজ্ঞাপন (Google Ad)</option>
                  <option value="YOUTUBE">ইউটিউব (YouTube)</option>
                  <option value="OTHER">অন্যান্য (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাজেট সীমা (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  বর্তমান অ্যাড স্পেন্ড: ৳{editingCampaign.spend.toLocaleString('en-IN')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্যাম্পেইন স্ট্যাটাস *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as CampaignItem['status'])}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-emerald-600 focus:outline-none"
                >
                  <option value="RUNNING">চলমান (Running)</option>
                  <option value="PLANNED">পরিকল্পিত (Planned)</option>
                  <option value="PAUSED">স্থগিত (Paused)</option>
                  <option value="ENDED">সমাপ্ত (Ended)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {editSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  আপডেট সংরক্ষণ (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
