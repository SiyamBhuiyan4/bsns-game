'use client';

import { useLanguage } from '@/components/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Plus,
  Search,
  Phone,
  AlertTriangle,
  MessageSquare,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  DollarSign,
  Star,
  RotateCcw,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'ORDERED' | 'LOST';
type BuyerType = 'RETAIL' | 'FARMER' | 'WHOLESALER' | 'RESTAURANT' | 'DEALER' | 'OTHER';

interface LeadItem {
  id: string;
  name: string;
  phone: string; // Full unmasked number visible to Admin
  masked_phone: string;
  address: string | null;
  buyer_type: BuyerType | string;
  product: { id: string; name_bn: string } | null;
  campaign: { id: string; name: string } | null;
  source_channel: string;
  owner_name: string;
  owner_email: string;
  status: LeadStatus;
  quality_rating: number | null;
  order_amount: number | null;
  expected_value: number | null;
  lost_reason: string | null;
  next_followup_date: string | null;
  notes_count: number;
  created_at: string;
  updated_at: string;
  days_since_update: number;
  days_waiting?: number;
  is_unfinished: boolean;
}

interface LeadDetailData extends LeadItem {
  notes: Array<{
    id: string;
    note: string;
    created_at: string;
    author: { id: string; name: string; role: string };
  }>;
}

interface MarketerOption {
  id: string;
  name: string;
  email: string;
}

export default function AdminLeadsPage() {
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name_bn: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [marketers, setMarketers] = useState<MarketerOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedMarketer, setSelectedMarketer] = useState<string>('ALL');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedBuyerType, setSelectedBuyerType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showUnfinishedOnly, setShowUnfinishedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Lead Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addBuyerType, setAddBuyerType] = useState('RETAIL');
  const [addProductId, setAddProductId] = useState('');
  const [addCampaignId, setAddCampaignId] = useState('');
  const [addOwnerId, setAddOwnerId] = useState('');
  const [addSource, setAddSource] = useState('ফেসবুক বিজ্ঞাপন (FB Ads)');
  const [addQualityRating, setAddQualityRating] = useState<number | ''>('');
  const [addExpectedValue, setAddExpectedValue] = useState('');
  const [addNextFollowup, setAddNextFollowup] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Deep link from the assistant: ?add=1 opens the add form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') setIsAddOpen(true);
  }, []);

  // Phone Duplicate Check Warning State (Admin reveals existing owner name)
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // Status Change Modal State
  const [statusLead, setStatusLead] = useState<LeadItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<LeadStatus>('ORDERED');
  const [statusQualityRating, setStatusQualityRating] = useState<number | ''>('');
  const [orderAmount, setOrderAmount] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Detail Drawer State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetail, setLeadDetail] = useState<LeadDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNoteText, setAdminNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Fetch leads based on all filters
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (activeTab !== 'ALL') params.append('status', activeTab);
      if (showUnfinishedOnly) params.append('unfinished', 'true');
      if (selectedMarketer !== 'ALL') params.append('marketerId', selectedMarketer);
      if (selectedChannel !== 'ALL') params.append('channel', selectedChannel);
      if (selectedBuyerType !== 'ALL') params.append('buyerType', selectedBuyerType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    showUnfinishedOnly,
    searchQuery,
    selectedMarketer,
    selectedChannel,
    selectedBuyerType,
    startDate,
    endDate,
  ]);

  const fetchMetadata = async () => {
    try {
      const [prodRes, campRes, empRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/campaigns'),
        fetch('/api/admin/employees'),
      ]);
      const prodData = await prodRes.json();
      const campData = await campRes.json();
      const empData = await empRes.json();

      if (prodRes.ok) setProducts(prodData.products || []);
      if (campRes.ok) setCampaigns(campData.campaigns || []);
      if (empRes.ok) {
        setMarketers(
          (empData.employees || []).map((e: any) => ({
            id: e.id,
            name: e.name,
            email: e.email,
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Live Phone Duplicate Check for Admin: reveals existing owner's name and status
  const handlePhoneChange = async (val: string) => {
    setAddPhone(val);
    const cleaned = val.replace(/[\s-]/g, '');
    if (cleaned.length >= 11) {
      setCheckingPhone(true);
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        if (data.exists) {
          if (data.ownerName) {
            setPhoneWarning(
              `এই নম্বরটি আগে থেকেই লিড হিসেবে আছে। মালিক: ${data.ownerName} (${data.ownerEmail || 'Email'}) - স্ট্যাটাস: ${data.status}`
            );
          } else {
            setPhoneWarning('এই নম্বরটি আগে থেকেই লিড হিসেবে আছে।');
          }
        } else {
          setPhoneWarning(null);
        }
      } catch {
        // ignore
      } finally {
        setCheckingPhone(false);
      }
    } else {
      setPhoneWarning(null);
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
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
          owner_id: addOwnerId || null,
          quality_rating: addQualityRating ? Number(addQualityRating) : null,
          expected_value: addExpectedValue ? parseFloat(addExpectedValue) : null,
          next_followup_date: addNextFollowup || null,
          initial_note: addNote || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('নতুন লিড সফলভাবে যুক্ত হয়েছে');
        setIsAddOpen(false);
        setAddName('');
        setAddPhone('');
        setAddAddress('');
        setAddOwnerId('');
        setAddExpectedValue('');
        setAddQualityRating('');
        setAddNote('');
        setPhoneWarning(null);
        fetchLeads();
      } else {
        setErrorMessage(data.error || 'লিড তৈরি ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setAddSubmitting(false);
    }
  };

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
          quality_rating: statusQualityRating ? Number(statusQualityRating) : null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('লিড স্ট্যাটাস সফলভাবে আপডেট হয়েছে');
        setStatusLead(null);
        setOrderAmount('');
        setLostReason('');
        setStatusQualityRating('');
        fetchLeads();
      } else {
        setStatusError(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setStatusError('নেটওয়ার্ক ত্রুটি');
    } finally {
      setStatusSubmitting(false);
    }
  };

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

  const handleAddAdminNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !adminNoteText.trim()) return;
    setNoteSubmitting(true);

    try {
      const res = await fetch(`/api/leads/${selectedLeadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: adminNoteText.trim() }),
      });
      const data = await res.json();
      if (res.ok && leadDetail) {
        setLeadDetail({
          ...leadDetail,
          notes: [data.note, ...leadDetail.notes],
        });
        setAdminNoteText('');
        fetchLeads();
      }
    } catch {
      // ignore
    } finally {
      setNoteSubmitting(false);
    }
  };

  const resetAllFilters = () => {
    setActiveTab('ALL');
    setSelectedMarketer('ALL');
    setSelectedChannel('ALL');
    setSelectedBuyerType('ALL');
    setStartDate('');
    setEndDate('');
    setShowUnfinishedOnly(false);
    setSearchQuery('');
  };

  const hasActiveFilters =
    activeTab !== 'ALL' ||
    selectedMarketer !== 'ALL' ||
    selectedChannel !== 'ALL' ||
    selectedBuyerType !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    showUnfinishedOnly ||
    searchQuery !== '';

  const unfinishedCount = leads.filter((l) => l.is_unfinished).length;

  const buyerTypeOptions = (
    <>
      <option value="RETAIL">{L('খুচরা', 'Retail')}</option>
      <option value="FARMER">{L('কৃষক', 'Farmer')}</option>
      <option value="WHOLESALER">{L('পাইকার', 'Wholesaler')}</option>
      <option value="RESTAURANT">{L('রেস্টুরেন্ট', 'Restaurant')}</option>
      <option value="DEALER">{L('ডিলার', 'Dealer')}</option>
      <option value="OTHER">{L('অন্যান্য', 'Other')}</option>
    </>
  );

  // Status Badge Component
  const getStatusBadge = (st: LeadStatus | string) => {
    switch (st) {
      case 'NEW':
        return <span className="badge badge-gray">{L('নতুন', 'New')}</span>;
      case 'CONTACTED':
        return <span className="badge badge-blue">{L('যোগাযোগ', 'Contacted')}</span>;
      case 'QUALIFIED':
        return <span className="badge badge-violet">{L('যোগ্য', 'Qualified')}</span>;
      case 'ORDERED':
        return <span className="badge badge-green">{L('অর্ডার', 'Ordered')}</span>;
      case 'LOST':
        return <span className="badge badge-red">{L('বাতিল', 'Lost')}</span>;
      default:
        return <span className="badge badge-gray">{st}</span>;
    }
  };

  // Buyer Type Badge Component
  const getBuyerTypeBadge = (type: string) => {
    switch (type) {
      case 'FARMER':
        return <span className="badge badge-gray">{L('কৃষক', 'Farmer')}</span>;
      case 'WHOLESALER':
        return <span className="badge badge-gray">{L('পাইকার', 'Wholesaler')}</span>;
      case 'RESTAURANT':
        return <span className="badge badge-gray">{L('রেস্টুরেন্ট', 'Restaurant')}</span>;
      case 'DEALER':
        return <span className="badge badge-gray">{L('ডিলার', 'Dealer')}</span>;
      case 'RETAIL':
        return <span className="badge badge-gray">{L('খুচরা', 'Retail')}</span>;
      default:
        return <span className="badge badge-gray">{L('অন্যান্য', 'Other')}</span>;
    }
  };

  // Quality Rating Stars Renderer (1-5 stars)
  const renderQualityStars = (rating: number | null) => {
    if (!rating || rating < 1) {
      return <span className="text-xs text-slate-400">—</span>;
    }
    return (
      <div className="flex items-center gap-0.5" title={`Quality: ${rating} / 5`} aria-label={`Quality ${rating} of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
          />
        ))}
      </div>
    );
  };

  const renderStarPicker = (value: number | '', onPick: (v: number | '') => void) => (
    <div className="flex items-center gap-0.5 py-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onPick(star === value ? '' : star)}
          className="rounded p-1 cursor-pointer hover:bg-slate-100"
          aria-label={`${star} star`}
        >
          <Star
            className={`h-5 w-5 ${
              value && star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            }`}
          />
        </button>
      ))}
      {value && <span className="ml-1 text-xs font-medium text-slate-600">{value}/5</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<UserPlus className="h-5 w-5" />}
        title={L('লিডস', 'Leads')}
        subtitle={L('কর্মীদের পাইপলাইন ও সম্পূর্ণ ফোন নম্বর', 'Employee pipeline with full phone numbers')}
        actions={
          <button
            onClick={() => {
              setIsAddOpen(true);
              setErrorMessage(null);
              setPhoneWarning(null);
            }}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {L('নতুন লিড', 'Add lead')}
          </button>
        }
      />

      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon h-6 w-6" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon h-6 w-6" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {unfinishedCount > 0 && (
        <div className="alert alert-warning flex-col sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {unfinishedCount} {L('লিড ৩+ দিন অপেক্ষমাণ', 'waiting 3+ days without an order')}
              </p>
              <p className="mt-0.5 text-xs opacity-80">Ask the owners to follow up.</p>
            </div>
          </div>
          <button
            onClick={() => setShowUnfinishedOnly(!showUnfinishedOnly)}
            className="btn btn-secondary btn-sm"
          >
            {showUnfinishedOnly ? L('সব লিড', 'Show all') : L('শুধু অপেক্ষমাণ', 'Show waiting')}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="max-w-full overflow-x-auto no-scrollbar">
            <div className="segmented whitespace-nowrap" role="tablist">
              {[
                { key: 'ALL', label: L('সব', 'All') },
                { key: 'LOST', label: L('বাতিল', 'Lost') },
              ].map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key && !showUnfinishedOnly}
                  data-active={activeTab === tab.key && !showUnfinishedOnly ? 'true' : undefined}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setShowUnfinishedOnly(false);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <button onClick={resetAllFilters} className="btn btn-ghost btn-sm">
              <RotateCcw className="h-3.5 w-3.5" />
              {L('রিসেট', 'Reset')}
            </button>
          )}
        </div>

        <div className="card-body space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <label htmlFor="lead_search" className="sr-only">Search</label>
            <input
              id="lead_search"
              type="text"
              placeholder={L('নাম, ফোন বা চ্যানেল', 'Search name, phone, channel')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="label" htmlFor="f_marketer">{L('মার্কেটার', 'Marketer')}</label>
              <select
                id="f_marketer"
                value={selectedMarketer}
                onChange={(e) => setSelectedMarketer(e.target.value)}
                className="input"
              >
                <option value="ALL">{L('সব', 'All')}</option>
                {marketers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="f_channel">{L('চ্যানেল', 'Channel')}</label>
              <select
                id="f_channel"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="input"
              >
                <option value="ALL">{L('সব', 'All')}</option>
                <option value="ফেসবুক বিজ্ঞাপন">{L('ফেসবুক বিজ্ঞাপন', 'FB Ads')}</option>
                <option value="ফেসবুক গ্রুপ">{L('ফেসবুক গ্রুপ', 'FB Group')}</option>
                <option value="গুগল বিজ্ঞাপন">{L('গুগল বিজ্ঞাপন', 'Google Ads')}</option>
                <option value="হোয়াটসঅ্যাপ">{L('হোয়াটসঅ্যাপ', 'WhatsApp')}</option>
                <option value="সরাসরি ফোন">{L('সরাসরি ফোন', 'Phone call')}</option>
                <option value="রেফারেল">{L('রেফারেল', 'Referral')}</option>
                <option value="ইউটিউব">{L('ইউটিউব', 'YouTube')}</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="f_buyer">{L('ক্রেতার ধরন', 'Buyer type')}</label>
              <select
                id="f_buyer"
                value={selectedBuyerType}
                onChange={(e) => setSelectedBuyerType(e.target.value)}
                className="input"
              >
                <option value="ALL">{L('সব', 'All')}</option>
                {buyerTypeOptions}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="f_start">{L('শুরু', 'From')}</label>
              <input
                id="f_start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="f_end">{L('শেষ', 'To')}</label>
              <input
                id="f_end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {L('লোড হচ্ছে', 'Loading…')}
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="h-5 w-5" />}
              title={L('কোনো লিড নেই', 'No leads found')}
              description={hasActiveFilters ? 'Try clearing the filters.' : 'Add a lead to start the pipeline.'}
              action={
                hasActiveFilters ? (
                  <button onClick={resetAllFilters} className="btn btn-secondary btn-sm">
                    <RotateCcw className="h-3.5 w-3.5" />
                    {L('রিসেট', 'Reset filters')}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{L('ক্রেতা', 'Customer')}</th>
                  <th>{L('মার্কেটার', 'Owner')}</th>
                  <th>{L('ধরন', 'Type')}</th>
                  <th>পণ্য / চ্যানেল</th>
                  <th className="text-center">{L('স্টেজ', 'Stage')}</th>
                  <th className="text-right">{L('মূল্য', 'Value')}</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className={l.is_unfinished ? 'bg-amber-50/40' : ''}>
                    <td className="min-w-[180px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => openDetail(l.id)}
                          className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          {l.name}
                        </button>
                        {l.is_unfinished && (
                          <span className="badge badge-amber">{l.days_since_update}d waiting</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3 shrink-0" />
                        <a href={`tel:${l.phone || l.masked_phone}`} className="tabular-nums hover:text-brand-700 hover:underline">
                          {l.phone || l.masked_phone}
                        </a>
                      </div>
                    </td>

                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="badge badge-blue text-[10px] font-semibold py-0.5">
                          {L('যুক্ত করেছেন', 'Added by')}
                        </span>
                        <span className="font-semibold text-slate-900">{l.owner_name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{l.owner_email}</div>
                    </td>

                    <td className="whitespace-nowrap">
                      <div className="space-y-1">
                        <div>{getBuyerTypeBadge(l.buyer_type)}</div>
                        <div>{renderQualityStars(l.quality_rating)}</div>
                      </div>
                    </td>

                    <td className="min-w-[140px]">
                      <div className="text-slate-900">{l.product ? l.product.name_bn : '—'}</div>
                      <div className="text-xs text-slate-500">{l.source_channel}</div>
                      {l.campaign && <div className="text-xs text-slate-500">{l.campaign.name}</div>}
                    </td>

                    <td className="whitespace-nowrap text-center">{getStatusBadge(l.status)}</td>

                    <td className="whitespace-nowrap text-right tabular-nums">
                      {l.status === 'ORDERED' && l.order_amount ? (
                        <span className="font-medium text-slate-900">৳ {l.order_amount.toLocaleString('en-IN')}</span>
                      ) : l.expected_value ? (
                        <span className="text-slate-500">৳ {l.expected_value.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setStatusLead(l);
                            setTargetStatus(l.status);
                            setStatusQualityRating(l.quality_rating || '');
                            setOrderAmount(l.order_amount ? String(l.order_amount) : '');
                            setLostReason(l.lost_reason || '');
                            setStatusError(null);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          {L('স্টেজ', 'Stage')}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => openDetail(l.id)}
                          className="btn btn-ghost btn-sm"
                          aria-label={`Notes (${l.notes_count})`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {l.notes_count}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Admin Detail Drawer */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="card-header">
              <h3 className="card-title">{L('লিড বিবরণ', 'Lead details')}</h3>
              <button
                onClick={() => {
                  setSelectedLeadId(null);
                  setLeadDetail(null);
                }}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading || !leadDetail ? (
                <div className="flex justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{leadDetail.name}</p>
                        <a
                          href={`tel:${leadDetail.phone}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-sm tabular-nums text-slate-600 hover:text-brand-700 hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {leadDetail.phone}
                        </a>
                      </div>
                      {getStatusBadge(leadDetail.status)}
                    </div>

                    <dl className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-3 text-xs">
                      <div>
                        <dt className="text-slate-500">{L('ক্রেতার ধরন', 'Type')}</dt>
                        <dd className="mt-1">{getBuyerTypeBadge(leadDetail.buyer_type)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{L('রেটিং', 'Rating')}</dt>
                        <dd className="mt-1">{renderQualityStars(leadDetail.quality_rating)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">{L('যুক্ত করেছেন (কর্মী)', 'Added by (Employee)')}</dt>
                        <dd className="mt-0.5 text-slate-900 flex items-center gap-2">
                          <span className="badge badge-blue text-[10px] font-medium">{L('কর্মী', 'Employee')}</span>
                          <span className="font-semibold">{leadDetail.owner_name}</span>
                          <span className="text-slate-500 text-xs">({leadDetail.owner_email})</span>
                        </dd>
                      </div>
                      {leadDetail.address && (
                        <div className="col-span-2">
                          <dt className="text-slate-500">{L('ঠিকানা', 'Address')}</dt>
                          <dd className="mt-0.5 text-slate-900">{leadDetail.address}</dd>
                        </div>
                      )}
                    </dl>

                    {leadDetail.status === 'ORDERED' && leadDetail.order_amount && (
                      <div className="alert alert-success">
                        {L('অর্ডার মূল্য', 'Order')}: ৳ {leadDetail.order_amount.toLocaleString('en-IN')}
                      </div>
                    )}

                    {leadDetail.status === 'LOST' && leadDetail.lost_reason && (
                      <div className="alert alert-error">{L('বাতিলের কারণ', 'Reason')}: {leadDetail.lost_reason}</div>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-[13px] font-semibold text-slate-900">{L('নোট', 'Notes')}</h4>
                    {leadDetail.notes.length === 0 ? (
                      <p className="text-xs text-slate-500">{L('কোনো নোট নেই', 'No notes yet')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {leadDetail.notes.map((n) => (
                          <li key={n.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                            <p className="leading-relaxed text-slate-800">{n.note}</p>
                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span>{n.author.name} · {n.author.role}</span>
                              <span>{format(new Date(n.created_at), 'dd MMM yyyy, hh:mm a')}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {leadDetail && (
              <form onSubmit={handleAddAdminNote} className="flex gap-2 border-t border-slate-100 p-4">
                <label htmlFor="admin_note" className="sr-only">Note</label>
                <input
                  id="admin_note"
                  type="text"
                  required
                  placeholder={L('নোট লিখুন', 'Write a note…')}
                  value={adminNoteText}
                  onChange={(e) => setAdminNoteText(e.target.value)}
                  className="input flex-1"
                />
                <button type="submit" disabled={noteSubmitting} className="btn btn-primary" aria-label="Send note">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Lead (Admin with phone duplicate check showing owner name) */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">{L('নতুন লিড', 'Add lead')}</h3>
              <button type="button" onClick={() => setIsAddOpen(false)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddLead}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="lead_name">{L('ক্রেতার নাম', 'Name *')}</label>
                  <input
                    id="lead_name"
                    type="text"
                    required
                    placeholder="যেমন: মো: আরিফুল ইসলাম"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="lead_phone">{L('মোবাইল', 'Phone *')}</label>
                  <div className="relative">
                    <input
                      id="lead_phone"
                      type="tel"
                      required
                      placeholder="017XXXXXXXX"
                      value={addPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="input tabular-nums"
                    />
                    {checkingPhone && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                  </div>
                  {phoneWarning ? (
                    <div className="alert alert-warning mt-2 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{phoneWarning}</span>
                    </div>
                  ) : (
                    <p className="hint">11-digit BD number. Duplicates show the current owner.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="lead_buyer">{L('ক্রেতার ধরন', 'Buyer type *')}</label>
                    <select
                      id="lead_buyer"
                      value={addBuyerType}
                      onChange={(e) => setAddBuyerType(e.target.value)}
                      className="input"
                    >
                      {buyerTypeOptions}
                    </select>
                  </div>
                  <div>
                    <span className="label">{L('রেটিং', 'Quality')}</span>
                    {renderStarPicker(addQualityRating, setAddQualityRating)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="lead_product">{L('পণ্য', 'Product')}</label>
                    <select
                      id="lead_product"
                      value={addProductId}
                      onChange={(e) => setAddProductId(e.target.value)}
                      className="input"
                    >
                      <option value="">— {L('নির্বাচন', 'Select')} —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name_bn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="lead_campaign">{L('ক্যাম্পেইন', 'Campaign')}</label>
                    <select
                      id="lead_campaign"
                      value={addCampaignId}
                      onChange={(e) => setAddCampaignId(e.target.value)}
                      className="input"
                    >
                      <option value="">— {L('নির্বাচন', 'Select')} —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="lead_source">{L('সোর্স', 'Source *')}</label>
                    <input
                      id="lead_source"
                      type="text"
                      required
                      placeholder="যেমন: ফেসবুক বিজ্ঞাপন"
                      value={addSource}
                      onChange={(e) => setAddSource(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="lead_expected">{L('সম্ভাব্য মূল্য', 'Expected (৳)')}</label>
                    <input
                      id="lead_expected"
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={addExpectedValue}
                      onChange={(e) => setAddExpectedValue(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="lead_address">{L('ঠিকানা', 'Address')}</label>
                    <input
                      id="lead_address"
                      type="text"
                      placeholder="উপজেলা, জেলা"
                      value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="lead_followup">{L('পরবর্তী ফলোআপ', 'Next follow-up')}</label>
                    <input
                      id="lead_followup"
                      type="date"
                      value={addNextFollowup}
                      onChange={(e) => setAddNextFollowup(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="lead_owner">{L('যুক্ত করেছেন / দায়িত্বপ্রাপ্ত কর্মী', 'Created by / Assigned Employee')}</label>
                  <select
                    id="lead_owner"
                    value={addOwnerId}
                    onChange={(e) => setAddOwnerId(e.target.value)}
                    className="input"
                  >
                    <option value="">{L('— অ্যাডমিন নিজে / বর্তমান ইউজার —', '— Admin (Current User) —')}</option>
                    {marketers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                  <p className="hint text-[11px] text-slate-500 mt-1">
                    {L('যে কর্মীকে নির্বাচন করবেন, তার নতুন ক্লায়েন্ট (NEW_CLIENTS) সংখ্যায় স্বয়ংক্রিয়ভাবে +১ যোগ হবে।', 'The selected employee will automatically receive +1 in their NEW_CLIENTS count.')}
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="lead_note">{L('নোট', 'Note')}</label>
                  <textarea
                    id="lead_note"
                    rows={2}
                    placeholder="ক্রেতার আগ্রহ ও প্রাথমিক কথা…"
                    value={addNote}
                    onChange={(e) => setAddNote(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={addSubmitting} className="btn btn-primary">
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('সংরক্ষণ', 'Save lead')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Transition & Quality Rating Update */}
      {statusLead && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div className="min-w-0">
                <h3 className="card-title">{L('স্টেজ পরিবর্তন', 'Change stage')}</h3>
                <p className="card-subtitle truncate">
                  {statusLead.name} · {statusLead.phone || statusLead.masked_phone}
                </p>
              </div>
              <button type="button" onClick={() => setStatusLead(null)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus}>
              <div className="card-body space-y-4">
                {statusError && (
                  <div className="alert alert-error">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{statusError}</span>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="target_status">{L('নতুন স্টেজ', 'Stage *')}</label>
                  <select
                    id="target_status"
                    value={targetStatus}
                    onChange={(e) => {
                      setTargetStatus(e.target.value as LeadStatus);
                      setStatusError(null);
                    }}
                    className="input"
                  >
                    <option value="NEW">{L('নতুন', 'New')}</option>
                    <option value="CONTACTED">{L('যোগাযোগ', 'Contacted')}</option>
                    <option value="QUALIFIED">{L('যোগ্য', 'Qualified')}</option>
                    <option value="ORDERED">{L('অর্ডার', 'Ordered')}</option>
                    <option value="LOST">{L('বাতিল', 'Lost')}</option>
                  </select>
                </div>

                <div>
                  <span className="label">{L('রেটিং', 'Quality')}</span>
                  {renderStarPicker(statusQualityRating, setStatusQualityRating)}
                </div>

                {targetStatus === 'ORDERED' && (
                  <div>
                    <label className="label" htmlFor="order_amount">{L('অর্ডার মূল্য', 'Order amount (৳) *')}</label>
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="order_amount"
                        type="number"
                        step="0.01"
                        required
                        min="1"
                        placeholder="5000"
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        className="input pl-9 tabular-nums"
                      />
                    </div>
                    <p className="hint">Required to mark a lead as ordered.</p>
                  </div>
                )}

                {targetStatus === 'LOST' && (
                  <div>
                    <label className="label" htmlFor="lost_reason">{L('বাতিলের কারণ', 'Lost reason *')}</label>
                    <textarea
                      id="lost_reason"
                      rows={2}
                      required
                      placeholder="যেমন: দাম বেশি মনে হয়েছে"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      className="input"
                    />
                    <p className="hint">Required to mark a lead as lost.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setStatusLead(null)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={statusSubmitting} className="btn btn-primary">
                  {statusSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('আপডেট', 'Update')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
