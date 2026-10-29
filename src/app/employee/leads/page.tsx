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
  X,
  Users,
  ShoppingBag,
  Coins,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import StatCard from '@/components/ui/StatCard';
import Avatar from '@/components/ui/Avatar';
import { SkeletonTable } from '@/components/ui/Skeleton';
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

/** Lead sources: the stored value is the Bangla name (the admin channel filter matches on it). */
const SOURCE_OPTIONS: [string, string][] = [
  ['ফেসবুক গ্রুপ', 'Facebook group'],
  ['ফেসবুক বিজ্ঞাপন', 'Facebook ads'],
  ['গুগল বিজ্ঞাপন', 'Google ads'],
  ['হোয়াটসঅ্যাপ', 'WhatsApp'],
  ['সরাসরি ফোন', 'Phone call'],
  ['রেফারেল', 'Referral'],
  ['ইউটিউব', 'YouTube'],
  ['অন্যান্য', 'Other'],
];

export default function EmployeeLeadsPage() {
  const { lang, L, formatNum, formatMoney } = useLanguage();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [showUnfinishedOnly, setShowUnfinishedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // The list refetches once typing pauses, not on every key press.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Lead Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
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
  const [detailError, setDetailError] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') setIsAddOpen(true);
    const p = params.get('period');
    if (p && ['1d', '3d', '7d', '30d', 'all', 'custom'].includes(p)) setDatePreset(p as typeof datePreset);
    const start = params.get('startDate') || params.get('from');
    if (start) setCustomStartDate(start);
    const end = params.get('endDate') || params.get('to');
    if (end) setCustomEndDate(end);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
      setDebouncedQuery(q);
    }
  }, []);

  // A success note clears itself after a few seconds.
  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  const fetchLeads = useCallback(async () => {
    try {
      let url = `/api/leads?q=${encodeURIComponent(debouncedQuery)}`;
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
      setLoadError(!res.ok);
      if (res.ok) {
        setLeads(data.leads || []);
        if (typeof data.can_view_all_customers === 'boolean') {
          setCanViewAllCustomers(data.can_view_all_customers);
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab, showUnfinishedOnly, debouncedQuery, datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    fetchLeads();
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
          const ownerDisplay = data.ownerName || L('অন্য কর্মী', 'another employee');
          const nameDisplay = data.leadName || L('নাম নেই', 'no name');
          const msg = L(
            `পুরাতন কাস্টমার: ${nameDisplay} · যোগ করেছেন: ${ownerDisplay}`,
            `Existing customer: ${nameDisplay} · added by ${ownerDisplay}`
          );
          setPhoneWarning(msg);
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
            message: L('নতুন কাস্টমার', 'New customer'),
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
      setErrorMessage(
        L(
          'এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে আছে। একই কাস্টমার দুবার যোগ করা যাবে না।',
          'This mobile number is already in the database. The same customer cannot be added twice.'
        )
      );
      return;
    }
    if (!addAddress.trim()) {
      setErrorMessage(L('এলাকা / লোকেশন দিন।', 'Enter the location.'));
      return;
    }
    if (addPhone.replace(/[\s-]/g, '').length < 11) {
      setErrorMessage(L('সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।', 'Enter a valid 11-digit mobile number.'));
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
          address: addAddress.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('নতুন লিড সফলভাবে যুক্ত হয়েছে', 'New lead added'));
        setIsAddOpen(false);
        setAddName('');
        setAddPhone('');
        setAddAddress('');
        setPhoneWarning(null);
        setPhoneCheckResult(null);
        fetchLeads();
      } else {
        setErrorMessage(data.error || L('লিড সংরক্ষণ করা যায়নি', 'Could not save the lead'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
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
        setSuccessMessage(L('লিড স্ট্যাটাস সফলভাবে আপডেট হয়েছে', 'Lead stage updated'));
        setStatusLead(null);
        setOrderAmount('');
        setLostReason('');
        fetchLeads();
      } else {
        setStatusError(data.error || L('আপডেট ব্যর্থ হয়েছে', 'Update failed'));
      }
    } catch {
      setStatusError(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Detail & Notes Drawer
  const openDetail = async (id: string) => {
    setSelectedLeadId(id);
    setLeadDetail(null);
    setDetailLoading(true);
    setDetailError(false);
    setNoteError(null);
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (res.ok && data.lead) {
        setLeadDetail(data.lead);
      } else {
        setDetailError(true);
      }
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedLeadId(null);
    setLeadDetail(null);
    setNoteError(null);
  };

  // Escape closes whichever overlay is on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (statusLead && !statusSubmitting) setStatusLead(null);
      else if (isAddOpen && !addSubmitting) setIsAddOpen(false);
      else if (selectedLeadId && !noteSubmitting) closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [statusLead, statusSubmitting, isAddOpen, addSubmitting, selectedLeadId, noteSubmitting]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newNoteText.trim()) return;
    setNoteSubmitting(true);
    setNoteError(null);

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
      } else if (!res.ok) {
        setNoteError(data.error || L('নোট সংরক্ষণ করা যায়নি', 'Could not save the note'));
      }
    } catch {
      setNoteError(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const unfinishedCount = leads.filter((l) => l.is_unfinished).length;
  const orderedLeads = leads.filter((l) => l.status === 'ORDERED');
  const orderedValue = orderedLeads.reduce((sum, l) => sum + (Number(l.order_amount) || 0), 0);
  const sourceLabel = (v: string) => {
    const hit = SOURCE_OPTIONS.find(([bn]) => v === bn || v.startsWith(`${bn} (`));
    return hit ? L(hit[0], hit[1]) : v;
  };
  /** Note time in Dhaka, in the chosen language; nothing for a bad timestamp. */
  const noteTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Dhaka',
    }).format(d);
  };

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

  const openStatus = (l: LeadItem) => {
    setStatusLead(l);
    setTargetStatus(l.status);
    setOrderAmount(l.order_amount ? String(l.order_amount) : '');
    setLostReason(l.lost_reason || '');
    setStatusError(null);
  };

  const renderValue = (l: LeadItem) =>
    l.status === 'ORDERED' && l.order_amount ? (
      <span className="font-semibold text-brand-700">{formatMoney(l.order_amount)}</span>
    ) : l.expected_value ? (
      <span className="text-slate-600">
        {formatMoney(l.expected_value)} <span className="text-xs text-slate-400">({L('সম্ভাব্য', 'est.')})</span>
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

      {!loading && !loadError && leads.length > 0 && (
        <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={L('এই তালিকায় লিড', 'Leads in view')}
            icon={<Users className="h-4 w-4" />}
            tone="blue"
            value={formatNum(leads.length)}
          />
          <StatCard
            label={L('অর্ডার হয়েছে', 'Ordered')}
            icon={<ShoppingBag className="h-4 w-4" />}
            tone="brand"
            value={formatNum(orderedLeads.length)}
          />
          <StatCard
            label={L('ফলোআপ বাকি', 'Need follow-up')}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="amber"
            value={formatNum(unfinishedCount)}
          />
          <StatCard
            label={L('অর্ডারের মোট মূল্য', 'Order value')}
            icon={<Coins className="h-4 w-4" />}
            tone="violet"
            value={formatMoney(orderedValue)}
          />
        </div>
      )}

      {unfinishedCount > 0 && (
        <div className="alert alert-warning flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {L(
                  `৩+ দিন অর্ডার ছাড়া অপেক্ষমাণ: ${formatNum(unfinishedCount)}`,
                  `Waiting 3+ days: ${formatNum(unfinishedCount)}`
                )}
              </div>
              <div className="mt-0.5 text-xs">
                {L('যোগ্য লিড, গত ৩ দিনে অর্ডার হয়নি। এখনই ফলোআপ করুন।', 'Qualified leads with no order in the last 3 days. Follow up now.')}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowUnfinishedOnly(!showUnfinishedOnly)}
            className="btn btn-secondary btn-sm min-h-9 self-start sm:self-auto"
          >
            {showUnfinishedOnly ? L('সকল লিড', 'Show all') : L('শুধু এগুলো', 'Show these')}
          </button>
        </div>
      )}

      {errorMessage && !isAddOpen && (
        <div role="alert" className="alert alert-error items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{L(errorMessage)}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn-icon h-10 w-10 shrink-0 text-rose-600 hover:bg-rose-100 hover:text-rose-800 sm:h-8 sm:w-8"
            aria-label={L('বন্ধ করুন', 'Dismiss')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div role="status" className="alert alert-success items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{L(successMessage)}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="btn-icon h-10 w-10 shrink-0 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 sm:h-8 sm:w-8"
            aria-label={L('বন্ধ করুন', 'Dismiss')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Access level + period filter */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-brand-600" />
            {L('সময়কাল:', 'Period:')}
          </span>
          {canViewAllCustomers ? (
            <span className="badge badge-green">
              <ShieldCheck className="h-3 w-3" />
              {L('সব কাস্টমার দেখার অনুমতি আছে', 'Full customer access')}
            </span>
          ) : (
            <span className="badge badge-blue">
              <Lock className="h-3 w-3" />
              {L('শুধু নিজের কাস্টমার', 'Your customers only')}
            </span>
          )}
        </div>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2">
            {[
              { id: '1d', label: L('১ দিন (আজ)', '1 Day (Today)') },
              { id: '3d', label: L('৩ দিন', '3 Days') },
              { id: '7d', label: L('৭ দিন', '7 Days') },
              { id: '30d', label: L('৩০ দিন', '30 Days') },
              { id: 'all', label: L('সকল সময়', 'All Time') },
              { id: 'custom', label: L('কাস্টম ক্যালেন্ডার', 'Custom Range') },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={datePreset === p.id}
                onClick={() => setDatePreset(p.id as typeof datePreset)}
                className={`press min-h-10 whitespace-nowrap rounded-xl px-3 text-xs font-medium transition sm:min-h-8 ${
                  datePreset === p.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {datePreset === 'custom' && (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:flex sm:items-end">
            <div>
              <label htmlFor="leads-from" className="label">
                {L('শুরুর তারিখ', 'Start date')}
              </label>
              <input
                id="leads-from"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input min-h-10 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="leads-to" className="label">
                {L('শেষ তারিখ', 'End date')}
              </label>
              <input
                id="leads-to"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input min-h-10 tabular-nums"
              />
            </div>
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
                type="button"
                data-active={activeTab === tab.key && !showUnfinishedOnly}
                onClick={() => {
                  setActiveTab(tab.key);
                  setShowUnfinishedOnly(false);
                }}
                className="min-h-9 whitespace-nowrap px-4"
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
              className="input min-h-10 pl-9 text-base sm:text-sm"
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
          <>
            {/* Phone: stacked row placeholders, desktop: table placeholders */}
            <div role="status" aria-busy="true" className="divide-y divide-slate-100 md:hidden">
              <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div aria-hidden className="skeleton h-4 w-32" />
                    <div aria-hidden className="skeleton h-4 w-16 rounded-full" />
                  </div>
                  <div aria-hidden className="skeleton h-3 w-24" />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div aria-hidden className="skeleton h-8 w-full rounded-lg" />
                    <div aria-hidden className="skeleton h-8 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <SkeletonTable rows={6} cols={6} label={L('লোড হচ্ছে...', 'Loading...')} />
            </div>
          </>
        ) : loadError && leads.length === 0 ? (
          <ErrorState title={L('লিড লোড করা যায়নি', 'Could not load your leads')} onRetry={fetchLeads} />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title={L('কোনো লিড পাওয়া যায়নি', 'No leads found')}
            description={L('নতুন লিড যোগ করুন বা ফিল্টার বদলে দেখুন।', 'Add a new lead or try a different filter.')}
            action={
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(true);
                  setErrorMessage(null);
                  setPhoneWarning(null);
                }}
                className="btn btn-primary min-h-10"
              >
                <Plus className="h-4 w-4" />
                <span>{L('নতুন লিড', 'Add lead')}</span>
              </button>
            }
          />
        ) : (
          <>
            {/* Phone: stacked rows */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {leads.map((l) => (
                <li key={l.id} className={`px-4 py-3.5 ${l.is_unfinished ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={l.name} size={36} animated={false} />
                      <div className="min-w-0">
                        <button
                          type="button"
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
                    </div>
                    {getStatusBadge(l.status)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {l.address && <span>{l.address}</span>}
                    {l.product && <span>{l.product.name_bn}</span>}
                    {l.is_unfinished && (
                      <span className="badge badge-amber tabular-nums">
                        {formatNum(l.days_since_update)} {L('দিন অপেক্ষমাণ', 'days waiting')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{formatBstDateTime(l.created_at, lang)}</span>
                    {canViewAllCustomers && l.owner_name && (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        · <Avatar name={l.owner_name} size={18} animated={false} /> {l.owner_name}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm tabular-nums">{renderValue(l)}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => openStatus(l)} className="btn btn-secondary min-h-10">
                      <span>{L('স্টেজ', 'Stage')}</span>
                      <ChevronRight className="h-4 w-4 text-brand-600" />
                    </button>
                    <button type="button" onClick={() => openDetail(l.id)} className="btn btn-secondary min-h-10">
                      <MessageSquare className="h-4 w-4 text-sky-600" />
                      <span>
                        {L('নোট', 'Notes')}
                        {l.notes_count > 0 ? ` (${formatNum(l.notes_count)})` : ''}
                      </span>
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
                    <th>{L('যোগ করার সময়', 'Added')}</th>
                    <th>{L('লোকেশন', 'Location')}</th>
                    <th>{L('পণ্য', 'Product')}</th>
                    <th>{L('স্টেজ', 'Stage')}</th>
                    <th className="text-right">{L('মূল্য', 'Value')}</th>
                    <th className="text-right">
                      <span className="sr-only">{L('অ্যাকশন', 'Actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className={l.is_unfinished ? 'bg-amber-50/40' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={l.name} size={34} animated={false} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openDetail(l.id)}
                                className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
                              >
                                {l.name}
                              </button>
                              {l.is_unfinished && (
                                <span className="badge badge-amber tabular-nums">
                                  {formatNum(l.days_since_update)} {L('দিন অপেক্ষমাণ', 'days waiting')}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-slate-500">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{l.masked_phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{formatBstDateTime(l.created_at, lang)}</span>
                        </div>
                        {canViewAllCustomers && l.owner_name && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Avatar name={l.owner_name} size={18} animated={false} />
                            <span className="font-semibold text-slate-800">{l.owner_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="max-w-[12rem] truncate text-xs">{l.address || '—'}</td>
                      <td className="text-xs">{l.product ? l.product.name_bn : '—'}</td>
                      <td>{getStatusBadge(l.status)}</td>
                      <td className="text-right tabular-nums">{renderValue(l)}</td>
                      <td className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button type="button" onClick={() => openStatus(l)} className="btn btn-secondary btn-sm min-h-9">
                            <span>{L('স্টেজ', 'Stage')}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-brand-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDetail(l.id)}
                            className="btn btn-ghost btn-sm min-h-9 text-sky-700"
                            title={L('বিস্তারিত ও নোট', 'Details and notes')}
                            aria-label={L('বিস্তারিত ও নোট', 'Details and notes')}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {l.notes_count > 0 && <span className="tabular-nums">{formatNum(l.notes_count)}</span>}
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
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !addSubmitting) setIsAddOpen(false);
          }}
        >
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-lead-title">
            <div className="card-header flex-nowrap">
              <div className="flex min-w-0 items-center gap-3">
                <span className="icon-tile">
                  <UserPlus className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 id="add-lead-title" className="card-title">{L('নতুন লিড', 'Add lead')}</h3>
                  <p className="card-subtitle">{L('সম্ভাব্য ক্রেতার তথ্য দিন', "Enter the customer's details")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="btn-icon h-10 w-10 shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddLead} className="card-body space-y-4 pb-0">
              {errorMessage && (
                <div role="alert" className="alert alert-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{L(errorMessage)}</span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                {L('শুধু নাম, মোবাইল নম্বর আর লোকেশন দিলেই হবে।', 'Just the name, mobile number and location.')}
              </p>
              <div>
                <label htmlFor="add-name" className="label">
                  {L('ক্রেতার নাম', 'Name')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="add-name"
                  type="text"
                  required
                  placeholder={L('যেমন: মো: আরিফুল ইসলাম', 'e.g. Md. Ariful Islam')}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="add-phone" className="label">
                  {L('মোবাইল নম্বর', 'Mobile number')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="add-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    aria-describedby="add-phone-hint"
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

                {!phoneCheckResult?.checked && (
                  <p id="add-phone-hint" className="hint">
                    {L('১১ সংখ্যা দিলে আমরা দেখে নিই নম্বরটি আগে থেকে আছে কি না।', "Once you type 11 digits we check it isn't already saved.")}
                  </p>
                )}
                {/* Live Feedback Status (Requirement 1) */}
                {phoneCheckResult?.checked && !phoneCheckResult.isExisting && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{L('নতুন কাস্টমার', 'New customer')}</span>
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

              <div>
                <label htmlFor="add-address" className="label">
                  {L('লোকেশন', 'Location')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="add-address"
                  type="text"
                  required
                  maxLength={500}
                  placeholder={L('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')}
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="input"
                />
              </div>

              <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={addSubmitting}
                  className="btn btn-secondary min-h-10"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting || checkingPhone || !!phoneCheckResult?.isExisting}
                  className="btn btn-primary min-h-10"
                >
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {addSubmitting ? L('সংরক্ষণ হচ্ছে...', 'Saving...') : L('লিড সংরক্ষণ করুন', 'Save lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Lead Status */}
      {statusLead && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !statusSubmitting) setStatusLead(null);
          }}
        >
          <div className="modal-panel sm:max-w-md" role="dialog" aria-modal="true" aria-labelledby="status-title">
            <div className="card-header flex-nowrap">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={statusLead.name} size={36} animated={false} />
                <div className="min-w-0">
                  <h3 id="status-title" className="card-title">{L('স্টেজ পরিবর্তন', 'Change stage')}</h3>
                  <p className="card-subtitle truncate">
                    {statusLead.name} · <span className="font-mono">{statusLead.masked_phone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusLead(null)}
                className="btn-icon h-10 w-10 shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="card-body space-y-4">
              {statusError && (
                <div className="alert alert-error">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{L(statusError)}</span>
                </div>
              )}

              <div>
                <label htmlFor="status-target" className="label">
                  {L('নতুন স্টেজ', 'New stage')} <span className="text-rose-500">*</span>
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
                    {L('অর্ডারের মূল্য (৳)', 'Order amount (৳)')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="status-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    inputMode="decimal"
                    placeholder={L('যেমন: ২৫০০', 'e.g. 2500')}
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
                    {L('বাতিলের কারণ', 'Lost reason')} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="status-reason"
                    rows={2}
                    required
                    placeholder={L('যেমন: মূল্য বেশি / অন্যখান থেকে কিনেছে', 'e.g. price too high / bought elsewhere')}
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="input"
                  />
                  <p className="hint">{L('বাতিলের কারণ আবশ্যক', 'Required for lost leads')}</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setStatusLead(null)}
                  disabled={statusSubmitting}
                  className="btn btn-secondary min-h-10"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting || targetStatus === statusLead.status}
                  className={`btn min-h-10 ${targetStatus === 'LOST' ? 'btn-danger' : 'btn-primary'}`}
                >
                  {statusSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {targetStatus === 'LOST' ? L('বাতিল হিসেবে চিহ্নিত করুন', 'Mark as lost') : L('আপডেট করুন', 'Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail & Notes Drawer */}
      {selectedLeadId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-detail-title"
          className="modal-backdrop justify-end p-0 sm:p-0"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-[var(--shadow-overlay)] animate-fade-in">
            <div className="card-header flex-nowrap">
              <div className="flex min-w-0 items-center gap-3">
                <span className="icon-tile icon-tile-sky">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <h3 id="lead-detail-title" className="card-title">{L('লিড বিবরণ ও নোট', 'Lead details & notes')}</h3>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="btn-icon h-10 w-10 shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailError && !detailLoading ? (
                <ErrorState
                  title={L('লিডের বিবরণ লোড করা যায়নি', 'Could not load this lead')}
                  onRetry={() => selectedLeadId && openDetail(selectedLeadId)}
                />
              ) : detailLoading || !leadDetail ? (
                <div role="status" aria-busy="true" className="card-body space-y-5">
                  <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
                  <div className="space-y-2">
                    <div aria-hidden className="skeleton h-4 w-40" />
                    <div aria-hidden className="skeleton h-9 w-full rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <div aria-hidden className="skeleton h-2.5 w-16" />
                        <div aria-hidden className="skeleton h-3.5 w-24" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} aria-hidden className="skeleton h-16 w-full rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card-body space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={leadDetail.name} size={44} />
                        <span className="truncate text-[15px] font-semibold text-slate-900">{leadDetail.name}</span>
                      </div>
                      {getStatusBadge(leadDetail.status)}
                    </div>

                    <a
                      href={`tel:${leadDetail.phone}`}
                      className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 font-mono text-sm font-medium text-slate-900 hover:bg-emerald-50"
                    >
                      <Phone className="h-4 w-4 text-brand-600" />
                      <span>{leadDetail.phone}</span>
                      <span className="ml-auto font-sans text-xs font-medium text-brand-700">{L('কল করুন', 'Call')}</span>
                    </a>

                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="text-slate-500">{L('লোকেশন', 'Location')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.address || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('পণ্য', 'Product')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.product ? leadDetail.product.name_bn : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('সোর্স', 'Source')}</dt>
                        <dd className="font-medium text-slate-900">{sourceLabel(leadDetail.source_channel)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('ক্যাম্পেইন', 'Campaign')}</dt>
                        <dd className="font-medium text-slate-900">{leadDetail.campaign ? leadDetail.campaign.name : '—'}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">{L('যোগ করেছেন', 'Added by')}</dt>
                        <dd className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                          {leadDetail.owner_name ? (
                            <>
                              <Avatar name={leadDetail.owner_name} size={24} animated={false} />
                              <span>{leadDetail.owner_name}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-900">{L('ফলোআপ নোট', 'Notes')}</h4>
                    {leadDetail.notes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        {L('কোনো নোট নেই', 'No notes yet')}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leadDetail.notes.map((n) => (
                          <div key={n.id} className="rounded-lg border border-slate-200 border-l-4 border-l-sky-400 p-3 text-sm">
                            <p className="leading-relaxed whitespace-pre-wrap text-slate-800">{n.note}</p>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Avatar name={n.author?.name || '?'} size={18} animated={false} />
                                <span className="truncate font-medium text-slate-600">{n.author?.name}</span>
                              </span>
                              <span className="shrink-0 tabular-nums">{noteTime(n.created_at)}</span>
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
              <form
                onSubmit={handleAddNote}
                className="space-y-2 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                {noteError && (
                  <p role="alert" className="text-xs font-medium text-rose-600">
                    {L(noteError)}
                  </p>
                )}
                <div className="flex gap-2">
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
                  className="input min-h-10 flex-1 text-base sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={noteSubmitting || !newNoteText.trim()}
                  className="btn btn-primary min-h-10"
                  aria-label={L('নোট পাঠান', 'Send note')}
                >
                  {noteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
