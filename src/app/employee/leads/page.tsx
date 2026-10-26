'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Plus,
  Search,
  Phone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Loader2,
  MessageSquare,
  DollarSign,
  ChevronRight,
  Send,
  Calendar,
  Clock,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';
import { formatBstDateTime } from '@/lib/date';

interface ProductRef {
  id: string;
  name_bn: string;
}

interface CampaignRef {
  id: string;
  name: string;
}

interface LeadItem {
  id: string;
  name: string;
  masked_phone: string;
  address: string | null;
  buyer_type: 'FARMER' | 'WHOLESALER' | 'RESTAURANT' | 'DEALER' | 'RETAIL' | 'OTHER';
  product: ProductRef | null;
  campaign: CampaignRef | null;
  source_channel: string;
  owner_name?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'ORDERED' | 'LOST';
  quality_rating: number | null;
  expected_value: number | null;
  order_amount: number | null;
  lost_reason: string | null;
  next_followup_date: string | null;
  notes_count: number;
  created_at: string;
  created_at_bst?: string;
  updated_at: string;
  days_since_update: number;
  is_unfinished: boolean;
}

interface LeadDetailData extends LeadItem {
  phone: string; // unmasked on detail
  notes: Array<{
    id: string;
    note: string;
    created_at: string;
    author: { id: string; name: string };
  }>;
}

export default function EmployeeLeadsPage() {
  const { lang, L } = useLanguage();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRef[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [showUnfinishedOnly, setShowUnfinishedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Lead Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addBuyerType, setAddBuyerType] = useState<'FARMER' | 'WHOLESALER' | 'RESTAURANT' | 'DEALER' | 'RETAIL' | 'OTHER'>('RETAIL');
  const [addProductId, setAddProductId] = useState('');
  const [addCampaignId, setAddCampaignId] = useState('');
  const [addSource, setAddSource] = useState('ফেসবুক গ্রুপ (FB Group)');
  const [addExpectedValue, setAddExpectedValue] = useState('');
  const [addNextFollowup, setAddNextFollowup] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Permissions & Calendar Date Presets
  const [canViewAllCustomers, setCanViewAllCustomers] = useState(false);
  const [datePreset, setDatePreset] = useState<'1d' | '3d' | '7d' | '30d' | 'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Phone Duplicate Check State (Requirement 1)
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [phoneCheckResult, setPhoneCheckResult] = useState<{
    checked: boolean;
    isExisting: boolean;
    leadName?: string;
    ownerName?: string;
    message?: string;
  } | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Status Change Modal (Acceptance Test 13)
  const [statusLead, setStatusLead] = useState<LeadItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'NEW' | 'CONTACTED' | 'QUALIFIED' | 'ORDERED' | 'LOST'>('ORDERED');
  const [orderAmount, setOrderAmount] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Detail Drawer
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<LeadDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') setIsAddOpen(true);
    const p = params.get('period');
    if (p && ['1d', '3d', '7d', '30d', 'all', 'custom'].includes(p)) setDatePreset(p as any);
    const start = params.get('startDate') || params.get('from');
    if (start) setCustomStartDate(start);
    const end = params.get('endDate') || params.get('to');
    if (end) setCustomEndDate(end);
    const q = params.get('q');
    if (q) setSearchQuery(q);
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      let url = `/api/leads?q=${encodeURIComponent(searchQuery)}`;
      if (activeTab !== 'ALL') {
        url += `&status=${activeTab}`;
      }
      if (showUnfinishedOnly) {
        url += `&unfinished=true`;
      }
      if (datePreset === 'custom') {
        if (customStartDate) url += `&startDate=${customStartDate}`;
        if (customEndDate) url += `&endDate=${customEndDate}`;
      } else if (datePreset !== 'all') {
        url += `&period=${datePreset}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
        if (typeof data.can_view_all_customers === 'boolean') {
          setCanViewAllCustomers(data.can_view_all_customers);
        }
      }
    } catch {
      setErrorMessage(L('লিড লোড করা যায়নি'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, showUnfinishedOnly, searchQuery, datePreset, customStartDate, customEndDate]);

  const fetchMetadata = async () => {
    try {
      const [prodRes, campRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/campaigns'),
      ]);
      const prodData = await prodRes.json();
      const campData = await campRes.json();
      if (prodRes.ok) setProducts(prodData.products || []);
      if (campRes.ok) setCampaigns(campData.campaigns || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchMetadata();
  }, [fetchLeads]);

  // Live Phone Duplicate Check (Requirement 1)
  const handlePhoneChange = async (val: string) => {
    setAddPhone(val);
    const cleaned = val.replace(/[\s-]/g, '');
    if (cleaned.length >= 11) {
      setCheckingPhone(true);
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        if (data.exists) {
          const ownerDisplay = data.ownerName || L('অন্য কর্মী');
          const msg = L(`পুরাতন কাস্টমার (Old Customer: ${data.leadName || 'বিদ্যমান'}, যোগ করেছেন: ${ownerDisplay})`);
          setPhoneWarning(L(`এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার: ${data.leadName || ''}, যোগ করেছেন: ${ownerDisplay})। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।`));
          setPhoneCheckResult({
            checked: true,
            isExisting: true,
            leadName: data.leadName,
            ownerName: ownerDisplay,
            message: msg,
          });
        } else if (data.valid) {
          setPhoneWarning(null);
          setPhoneCheckResult({
            checked: true,
            isExisting: false,
            message: L('নতুন কাস্টমার (New Customer)'),
          });
        } else {
          setPhoneWarning(null);
          setPhoneCheckResult(null);
        }
      } catch {
        // ignore
      } finally {
        setCheckingPhone(false);
      }
    } else {
      setPhoneWarning(null);
      setPhoneCheckResult(null);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneCheckResult?.isExisting) {
      setErrorMessage(L('এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার)। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।'));
      return;
    }
    setAddSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          phone: addPhone,
          address: addAddress,
          buyer_type: addBuyerType,
          product_id: addProductId || null,
          campaign_id: addCampaignId || null,
          source_channel: addSource,
          expected_value: addExpectedValue ? parseFloat(addExpectedValue) : null,
          next_followup_date: addNextFollowup || null,
          initial_note: addNote || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('নতুন লিড সফলভাবে যুক্ত হয়েছে'));
        setIsAddOpen(false);
        setAddName('');
        setAddPhone('');
        setAddAddress('');
        setAddExpectedValue('');
        setAddNote('');
        setPhoneWarning(null);
        setPhoneCheckResult(null);
        fetchLeads();
      } else {
        setErrorMessage(data.error || L('এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার)। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setAddSubmitting(false);
    }
  };

  // Status transition handler (Acceptance Test 13)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusLead) return;
    setStatusSubmitting(true);
    setStatusError(null);

    try {
      const res = await fetch(`/api/leads/${statusLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          order_amount: targetStatus === 'ORDERED' ? parseFloat(orderAmount) : null,
          lost_reason: targetStatus === 'LOST' ? lostReason : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('লিড স্ট্যাটাস সফলভাবে আপডেট হয়েছে'));
        setStatusLead(null);
        setOrderAmount('');
        setLostReason('');
        fetchLeads();
      } else {
        setStatusError(data.error || L('আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setStatusError(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Detail & Notes Drawer
  const openDetail = async (id: string) => {
    setSelectedLeadId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (res.ok) {
        setLeadDetail(data.lead);
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNoteText.trim()) return;
    setNoteSubmitting(true);

    try {
      const res = await fetch(`/api/leads/${selectedLeadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNoteText.trim() }),
      });
      const data = await res.json();
      if (res.ok && leadDetail) {
        setLeadDetail({
          ...leadDetail,
          notes: [data.note, ...leadDetail.notes],
        });
        setNewNoteText('');
        fetchLeads();
      }
    } catch {
      // ignore
    } finally {
      setNoteSubmitting(false);
    }
  };

  const unfinishedCount = leads.filter((l) => l.is_unfinished).length;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'NEW':
        return <span className="badge badge-blue">{L('নতুন', 'New')}</span>;
      case 'CONTACTED':
        return <span className="badge badge-violet">{L('যোগাযোগ', 'Contacted')}</span>;
      case 'QUALIFIED':
        return <span className="badge badge-amber">{L('যোগ্য', 'Qualified')}</span>;
      case 'ORDERED':
        return <span className="badge badge-green">{L('অর্ডার', 'Ordered')}</span>;
      case 'LOST':
        return <span className="badge badge-red">{L('বাতিল', 'Lost')}</span>;
    }
  };

  const getBuyerTypeLabel = (bt: string) => {
    switch (bt) {
      case 'FARMER': return L('কৃষক', 'Farmer');
      case 'WHOLESALER': return L('পাইকার', 'Wholesaler');
      case 'RESTAURANT': return L('রেস্টুরেন্ট', 'Restaurant');
      case 'DEALER': return L('ডিলার', 'Dealer');
      case 'RETAIL': return L('খুচরা', 'Retail');
      default: return L('অন্যান্য', 'Other');
    }
  };

  const openStatus = (l: LeadItem) => {
    setStatusLead(l);
    setTargetStatus(l.status);
    setOrderAmount(l.order_amount ? String(l.order_amount) : '');
    setLostReason(l.lost_reason || '');
    setStatusError(null);
  };

  const renderValue = (l: LeadItem) =>
    l.status === 'ORDERED' && l.order_amount ? (
      <span className="font-medium text-brand-700">{L("৳")} {l.order_amount.toLocaleString('en-IN')}</span>
    ) : l.expected_value ? (
      <span className="text-slate-600">
        {L("৳")} {l.expected_value.toLocaleString('en-IN')} <span className="text-xs text-slate-400">({L('সম্ভাব্য', 'est.')})</span>
      </span>
    ) : (
      <span className="text-slate-400">—</span>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<UserPlus className="h-5 w-5" />}
        title={L('আমার লিড', 'My Leads')}
        subtitle={L('লিড সংগ্রহ, ফলোআপ ও অর্ডারে রূপান্তর করুন।', 'Capture, follow up and convert leads.')}
        actions={
          <button
            onClick={() => {
              setIsAddOpen(true);
              setErrorMessage(null);
              setPhoneWarning(null);
            }}
            className="btn btn-primary min-h-10 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>{L('নতুন লিড', 'Add lead')}</span>
          </button>
        }
      />

      {unfinishedCount > 0 && (
        <div className="alert alert-warning flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {L(`৩+ দিন অর্ডার ছাড়া অপেক্ষমাণ: ${unfinishedCount}`, `Waiting 3+ days: ${unfinishedCount}`)}
              </div>
              <div className="mt-0.5 text-xs">
                {L('যোগ্য লিড, গত ৩ দিনে অর্ডার হয়নি। এখনই ফলোআপ করুন।', 'Qualified leads with no order in the last 3 days. Follow up now.')}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowUnfinishedOnly(!showUnfinishedOnly)}
            className="btn btn-secondary btn-sm self-start sm:self-auto"
          >
            {showUnfinishedOnly ? L('সকল লিড', 'Show all') : L('শুধু এগুলো', 'Show these')}
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn-icon h-7 w-7 text-rose-600 hover:bg-rose-100 hover:text-rose-800"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="btn-icon h-7 w-7 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Permission Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {canViewAllCustomers ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {L('সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি সক্রিয় (Full Access)', 'Full Customer Database Access Granted')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              {L('নিজস্ব কাস্টমার তালিকা (Own Customers Only)', 'Viewing Own Customers Only')}
            </span>
          )}
        </div>
      </div>

      {/* Date Filter Presets & Calendar Range */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs">
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 mr-1">
          <Calendar className="h-3.5 w-3.5 text-brand-600" />
          {L('সময়কাল:', 'Period:')}
        </span>
        {[
          { id: '1d', label: L('১ দিন (আজ)', '1 Day (Today)') },
          { id: '3d', label: L('৩ দিন', '3 Days') },
          { id: '7d', label: L('৭ দিন', '7 Days') },
          { id: '30d', label: L('৩০ দিন', '30 Days') },
          { id: 'all', label: L('সকল সময়', 'All Time') },
          { id: 'custom', label: L('কাস্টম ক্যালেন্ডার', 'Custom Range') },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setDatePreset(p.id as any)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              datePreset === p.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="input h-8 px-2 py-0.5 text-xs"
              title={L('শুরুর তারিখ', 'Start date')}
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="input h-8 px-2 py-0.5 text-xs"
              title={L('শেষ তারিখ', 'End date')}
            />
          </div>
        )}
      </div>

      {/* Stage tabs + search */}
      <div className="space-y-3">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="segmented">
            {[
              { key: 'ALL', label: L('সকল', 'All') },
              { key: 'LOST', label: L('বাতিল', 'Lost') },
            ].map((tab) => (
              <button
                key={tab.key}
                data-active={activeTab === tab.key && !showUnfinishedOnly}
                onClick={() => {
                  setActiveTab(tab.key);
                  setShowUnfinishedOnly(false);
                }}
                className="whitespace-nowrap"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <label htmlFor="leads-search" className="sr-only">
              {L('অনুসন্ধান', 'Search')}
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="leads-search"
              type="text"
              placeholder={L('নাম, ফোন বা চ্যানেল', 'Search name, phone, channel')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          {showUnfinishedOnly && (
            <span className="badge badge-amber self-start sm:self-auto">
              <AlertTriangle className="h-3 w-3" />
              {L('৩+ দিন অপেক্ষমাণ ফিল্টার', '3+ day filter on')}
            </span>
          )}
        </div>
      </div>

      {/* Leads list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-brand-600" />
            <p className="text-sm">{L('লোড হচ্ছে...', 'Loading...')}</p>
          </div>
        ) : leads.length === 0 ? (
          <EmptyState icon={<UserPlus className="h-5 w-5" />} title={L('কোনো লিড পাওয়া যায়নি', 'No leads found')} />
        ) : (
          <>
            {/* Phone: stacked rows */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {leads.map((l) => (
                <li key={l.id} className={`px-4 py-3.5 ${l.is_unfinished ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        onClick={() => openDetail(l.id)}
                        className="block max-w-full truncate text-left text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {l.name}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{l.masked_phone}</span>
                      </div>
                    </div>
                    {getStatusBadge(l.status)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{getBuyerTypeLabel(l.buyer_type)}</span>
                    {l.product && <span>{l.product.name_bn}</span>}
                    {l.is_unfinished && (
                      <span className="badge badge-amber">{l.days_since_update} {L('দিন অপেক্ষমাণ', 'days waiting')}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{formatBstDateTime(l.created_at, lang)}</span>
                    {canViewAllCustomers && l.owner_name && (
                      <span className="font-medium text-slate-700">({L('যোগ করেছেন:', 'By:')} {l.owner_name})</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm tabular-nums">{renderValue(l)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => openStatus(l)} className="btn btn-secondary min-h-10">
                      <span>{L('স্টেজ', 'Stage')}</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => openDetail(l.id)} className="btn btn-secondary min-h-10">
                      <MessageSquare className="h-4 w-4" />
                      <span>{L('নোট', 'Notes')}{l.notes_count > 0 ? ` (${l.notes_count})` : ''}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-pro">
                <thead>
                  <tr>
                    <th>{L('ক্রেতা', 'Customer')}</th>
                    <th>{L('যোগ করার সময় (BST)', 'Added (BST)')}</th>
                    <th>{L('ধরন', 'Type')}</th>
                    <th>{L('পণ্য', 'Product')}</th>
                    <th>{L('স্টেজ', 'Stage')}</th>
                    <th className="text-right">{L('মূল্য', 'Value')}</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className={l.is_unfinished ? 'bg-amber-50/40' : ''}>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openDetail(l.id)}
                            className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                          >
                            {l.name}
                          </button>
                          {l.is_unfinished && (
                            <span className="badge badge-amber">{l.days_since_update} {L('দিন অপেক্ষমাণ', 'days waiting')}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{l.masked_phone}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{formatBstDateTime(l.created_at, lang)}</span>
                        </div>
                        {canViewAllCustomers && l.owner_name && (
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {L('যোগ করেছেন:', 'By:')} <span className="font-semibold text-slate-800">{l.owner_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="text-xs">{getBuyerTypeLabel(l.buyer_type)}</td>
                      <td className="text-xs">{l.product ? l.product.name_bn : '—'}</td>
                      <td>{getStatusBadge(l.status)}</td>
                      <td className="text-right tabular-nums">{renderValue(l)}</td>
                      <td className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button onClick={() => openStatus(l)} className="btn btn-secondary btn-sm">
                            <span>{L('স্টেজ', 'Stage')}</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openDetail(l.id)}
                            className="btn btn-ghost btn-sm"
                            title={L('বিস্তারিত ও নোট', 'Details and notes')}
                            aria-label={L('বিস্তারিত ও নোট', 'Details and notes')}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {l.notes_count > 0 && <span className="tabular-nums">{l.notes_count}</span>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal: Add Lead */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div>
                <h3 className="card-title">{L('নতুন লিড', 'Add lead')}</h3>
                <p className="card-subtitle">{L('সম্ভাব্য ক্রেতার তথ্য দিন', "Enter the customer's details")}</p>
              </div>
            </div>

            <form onSubmit={handleAddLead} className="card-body space-y-4">
              <div>
                <label htmlFor="add-name" className="label">
                  {L('ক্রেতার নাম *', 'Name *')}
                </label>
                <input
                  id="add-name"
                  type="text"
                  required
                  placeholder={L("যেমন: মো: আরিফুল ইসলাম")}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="add-phone" className="label">
                  {L('মোবাইল নম্বর * (অদ্বিতীয় / Unique)', 'Phone * (Unique in DB)')}
                </label>
                <div className="relative">
                  <input
                    id="add-phone"
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={addPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`input pr-9 font-mono ${
                      phoneCheckResult?.isExisting
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-rose-200'
                        : phoneCheckResult?.checked
                        ? 'border-emerald-400 bg-emerald-50/20 focus:border-emerald-500 focus:ring-emerald-200'
                        : ''
                    }`}
                  />
                  {checkingPhone && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Live Feedback Status (Requirement 1) */}
                {phoneCheckResult?.checked && !phoneCheckResult.isExisting && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{L('নতুন কাস্টমার (New Customer)', 'New Customer')}</span>
                  </div>
                )}

                {phoneCheckResult?.checked && phoneCheckResult.isExisting && (
                  <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{phoneCheckResult.message}</span>
                    </div>
                    <p className="text-[11px] text-rose-600">
                      {L(
                        'এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার)। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।',
                        'This mobile number already exists in the database (Old Customer). Duplicate customers cannot be added.'
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="add-type" className="label">
                    {L('ক্রেতার ধরন *', 'Buyer type *')}
                  </label>
                  <select
                    id="add-type"
                    value={addBuyerType}
                    onChange={(e) => setAddBuyerType(e.target.value as LeadItem['buyer_type'])}
                    className="input"
                  >
                    <option value="RETAIL">{L('খুচরা', 'Retail')}</option>
                    <option value="WHOLESALER">{L('পাইকার', 'Wholesaler')}</option>
                    <option value="FARMER">{L('কৃষক', 'Farmer')}</option>
                    <option value="RESTAURANT">{L('রেস্টুরেন্ট', 'Restaurant')}</option>
                    <option value="DEALER">{L('ডিলার', 'Dealer')}</option>
                    <option value="OTHER">{L('অন্যান্য', 'Other')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="add-product" className="label">
                    {L('আগ্রহী পণ্য', 'Product')}
                  </label>
                  <select
                    id="add-product"
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    className="input"
                  >
                    <option value="">{L('নির্বাচন করুন', 'Select...')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_bn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="add-source" className="label">
                    {L('সোর্স *', 'Source *')}
                  </label>
                  <input
                    id="add-source"
                    type="text"
                    required
                    placeholder={L("ফেসবুক গ্রুপ / অ্যাড / কল")}
                    value={addSource}
                    onChange={(e) => setAddSource(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="add-campaign" className="label">
                    {L('ক্যাম্পেইন', 'Campaign')}
                  </label>
                  <select
                    id="add-campaign"
                    value={addCampaignId}
                    onChange={(e) => setAddCampaignId(e.target.value)}
                    className="input"
                  >
                    <option value="">{L('ক্যাম্পেইন নেই', 'None')}</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="add-value" className="label">
                    {L('সম্ভাব্য মূল্য (৳)', 'Expected (৳)')}
                  </label>
                  <input
                    id="add-value"
                    type="number"
                    min="0"
                    placeholder={L("যেমন: 5000")}
                    value={addExpectedValue}
                    onChange={(e) => setAddExpectedValue(e.target.value)}
                    className="input tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="add-followup" className="label">
                    {L('পরবর্তী ফলোআপ', 'Next follow-up')}
                  </label>
                  <input
                    id="add-followup"
                    type="date"
                    value={addNextFollowup}
                    onChange={(e) => setAddNextFollowup(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-address" className="label">
                  {L('ঠিকানা', 'Address')}
                </label>
                <input
                  id="add-address"
                  type="text"
                  placeholder={L("যেমন: মিরপুর ১০, ঢাকা")}
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="add-note" className="label">
                  {L('প্রাথমিক নোট', 'Initial note')}
                </label>
                <textarea
                  id="add-note"
                  rows={2}
                  placeholder={L("ক্রেতার চাহিদা বা যোগাযোগের বিবরণ...")}
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary min-h-10">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting || !!phoneCheckResult?.isExisting}
                  className="btn btn-primary min-h-10"
                >
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('সংরক্ষণ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Lead Status */}
      {statusLead && (
        <div className="modal-backdrop">
          <div className="modal-panel sm:max-w-md">
            <div className="card-header">
              <div className="min-w-0">
                <h3 className="card-title">{L('স্টেজ পরিবর্তন', 'Change stage')}</h3>
                <p className="card-subtitle truncate">
                  {statusLead.name} · <span className="font-mono">{statusLead.masked_phone}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateStatus} className="card-body space-y-4">
              {statusError && (
                <div className="alert alert-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              <div>
                <label htmlFor="status-target" className="label">
                  {L('নতুন স্টেজ *', 'New stage *')}
                </label>
                <select
                  id="status-target"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as LeadItem['status'])}
                  className="input"
                >
                  <option value="NEW">{L('নতুন', 'New')}</option>
                  <option value="CONTACTED">{L('যোগাযোগ', 'Contacted')}</option>
                  <option value="QUALIFIED">{L('যোগ্য', 'Qualified')}</option>
                  <option value="ORDERED">{L('অর্ডার', 'Ordered')}</option>
                  <option value="LOST">{L('বাতিল', 'Lost')}</option>
                </select>
              </div>

              {targetStatus === 'ORDERED' && (
                <div>
                  <label htmlFor="status-amount" className="label flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                    {L('অর্ডারের মূল্য (৳) *', 'Order amount (৳) *')}
                  </label>
                  <input
                    id="status-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder={L("যেমন: 2500.00")}
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    className="input tabular-nums"
                  />
                  <p className="hint">{L('অর্ডার হলে মূল্য দেওয়া আবশ্যক', 'Required for ordered leads')}</p>
                </div>
              )}

              {targetStatus === 'LOST' && (
                <div>
                  <label htmlFor="status-reason" className="label flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    {L('বাতিলের কারণ *', 'Lost reason *')}
                  </label>
                  <textarea
                    id="status-reason"
                    rows={2}
                    required
                    placeholder={L("যেমন: মূল্য বেশি / অন্যখান থেকে কিনেছে")}
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="input"
                  />
                  <p className="hint">{L('বাতিলের কারণ আবশ্যক', 'Required for lost leads')}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setStatusLead(null)} className="btn btn-secondary min-h-10">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={statusSubmitting} className="btn btn-primary min-h-10">
                  {statusSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('আপডেট', 'Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail & Notes Drawer */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl animate-in slide-in-from-right duration-300">
            <div className="card-header">
              <h3 className="card-title">{L('লিড বিবরণ', 'Lead details')}</h3>
              <button
                onClick={() => {
                  setSelectedLeadId(null);
                  setLeadDetail(null);
                }}
                className="btn-icon"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailLoading || !leadDetail ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : (
                <div className="card-body space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold text-slate-900">{leadDetail.name}</span>
                      {getStatusBadge(leadDetail.status)}
                    </div>

                    <a
                      href={`tel:${leadDetail.phone}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                      <Phone className="h-4 w-4 text-brand-600" />
                      <span>{leadDetail.phone}</span>
                    </a>

                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="text-slate-500">{L('ধরন', 'Type')}</dt>
                        <dd className="font-medium text-slate-900">{getBuyerTypeLabel(leadDetail.buyer_type)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('পণ্য', 'Product')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.product ? leadDetail.product.name_bn : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('সোর্স', 'Source')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.source_channel}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('ক্যাম্পেইন', 'Campaign')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.campaign ? leadDetail.campaign.name : '—'}</dd>
                      </div>
                      {leadDetail.address && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">{L('ঠিকানা', 'Address')}</dt>
                          <dd className="font-medium text-slate-900">{leadDetail.address}</dd>
                        </div>
                      )}
                      <div className="col-span-2">
                        <dt className="text-slate-500">{L('যুক্ত করেছেন (কর্মী)', 'Added by (Employee)')}</dt>
                        <dd className="font-semibold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <span className="badge badge-blue text-[10px] font-normal">{L('কর্মী', 'Employee')}</span>
                          <span>{leadDetail.owner_name}</span>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-900">{L('ফলোআপ নোট', 'Notes')}</h4>
                    {leadDetail.notes.length === 0 ? (
                      <p className="text-sm text-slate-500">{L('কোনো নোট নেই', 'No notes yet')}</p>
                    ) : (
                      <div className="space-y-2">
                        {leadDetail.notes.map((n) => (
                          <div key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                            <p className="leading-relaxed text-slate-800">{n.note}</p>
                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                              <span>{n.author.name}</span>
                              <span>{format(new Date(n.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {leadDetail && (
              <form onSubmit={handleAddNote} className="flex gap-2 border-t border-slate-100 p-4">
                <label htmlFor="new-note" className="sr-only">
                  {L('নতুন নোট', 'New note')}
                </label>
                <input
                  id="new-note"
                  type="text"
                  required
                  placeholder={L('নতুন ফলোআপ নোট', 'New note...')}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="btn btn-primary min-h-10"
                  aria-label={L('নোট পাঠান', 'Send note')}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
