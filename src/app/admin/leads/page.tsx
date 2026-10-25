'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Plus,
  Search,
  Phone,
  AlertTriangle,
  Users,
  MessageSquare,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  DollarSign,
  Star,
  Filter,
  Calendar,
  RotateCcw,
  Tag,
  Building,
} from 'lucide-react';
import { format } from 'date-fns';

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
              `⚠️ সতর্কবার্তা: এই মোবাইল নম্বরটি ইতিমধ্যে সিস্টেমে লিড হিসেবে বিদ্যমান। বর্তমান মালিক: ${data.ownerName} (${data.ownerEmail || 'Email'}) - স্ট্যাটাস: ${data.status}`
            );
          } else {
            setPhoneWarning('⚠️ সতর্কবার্তা: এই মোবাইল নম্বরটি ইতিমধ্যে সিস্টেমে লিড হিসেবে বিদ্যমান।');
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

  // Status Badge Component
  const getStatusBadge = (st: LeadStatus | string) => {
    switch (st) {
      case 'NEW':
        return (
          <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[11px] font-bold border border-blue-200">
            নতুন (NEW)
          </span>
        );
      case 'CONTACTED':
        return (
          <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[11px] font-bold border border-purple-200">
            যোগাযোগকৃত (CONTACTED)
          </span>
        );
      case 'QUALIFIED':
        return (
          <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-bold border border-amber-200">
            যোগ্য (QUALIFIED)
          </span>
        );
      case 'ORDERED':
        return (
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
            অর্ডার সম্পন্ন (ORDERED)
          </span>
        );
      case 'LOST':
        return (
          <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[11px] font-bold border border-rose-200">
            বাতিল (LOST)
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-bold">
            {st}
          </span>
        );
    }
  };

  // Buyer Type Badge Component
  const getBuyerTypeBadge = (type: string) => {
    switch (type) {
      case 'FARMER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium">
            <Tag className="h-3 w-3 text-emerald-600" />
            কৃষক (Farmer)
          </span>
        );
      case 'WHOLESALER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium">
            <Building className="h-3 w-3 text-indigo-600" />
            পাইকার (Wholesaler)
          </span>
        );
      case 'RESTAURANT':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-medium">
            <Tag className="h-3 w-3 text-amber-600" />
            রেস্টুরেন্ট (Restaurant)
          </span>
        );
      case 'DEALER':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 text-[11px] font-medium">
            <Building className="h-3 w-3 text-cyan-600" />
            ডিলার (Dealer)
          </span>
        );
      case 'RETAIL':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[11px] font-medium">
            <Tag className="h-3 w-3 text-blue-600" />
            খুচরা (Retail)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-medium">
            অন্যান্য (Other)
          </span>
        );
    }
  };

  // Quality Rating Stars Renderer (1-5 stars)
  const renderQualityStars = (rating: number | null) => {
    if (!rating || rating < 1) {
      return <span className="text-slate-400 text-xs italic">রেটিং নেই</span>;
    }
    return (
      <div className="flex items-center gap-0.5" title={`কোয়ালিটি রেটিং: ${rating} / ৫`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${
              star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
            }`}
          />
        ))}
        <span className="text-[11px] font-mono font-bold text-amber-700 ml-1">
          {rating}/৫
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-emerald-600" />
            টিম লিডস পাইপলাইন ও বিক্রয় পর্যবেক্ষণ (Team Leads Management)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            এডমিন ভিউ: সকল মার্কেটারের পূর্ণ নম্বর, স্ট্যাটাস, ক্রেতার ধরন ও কোয়ালিটি রেটিং ফিল্টারসহ পর্যবেক্ষণ করুন।
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setErrorMessage(null);
            setPhoneWarning(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন লিড যুক্ত করুন (Add Lead)</span>
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

      {/* Unfinished Orders Warning Box */}
      {unfinishedCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                ৩+ দিন ধরে অপেক্ষমাণ অর্ডারহীন লিড: {unfinishedCount} জন (Unfinished Orders Alert)
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                সংশ্লিষ্ট মার্কেটারদের দ্রুত ফলোআপ সম্পন্ন করে অর্ডারে রূপান্তর করার নির্দেশ দিন।
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowUnfinishedOnly(!showUnfinishedOnly)}
            className="self-start sm:self-auto rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors cursor-pointer"
          >
            {showUnfinishedOnly ? 'সকল লিড দেখুন' : 'অপেক্ষমাণ লিড ফিল্টার করুন'}
          </button>
        </div>
      )}

      {/* Stage Filter Tabs (NEW, CONTACTED, QUALIFIED, ORDERED, LOST) */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold">
        {[
          { key: 'ALL', label: 'সকল লিড' },
          { key: 'NEW', label: 'নতুন (NEW)' },
          { key: 'CONTACTED', label: 'যোগাযোগকৃত (CONTACTED)' },
          { key: 'QUALIFIED', label: 'যোগ্য (QUALIFIED)' },
          { key: 'ORDERED', label: 'অর্ডার সম্পন্ন (ORDERED)' },
          { key: 'LOST', label: 'বাতিল (LOST)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowUnfinishedOnly(false);
            }}
            className={`px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key && !showUnfinishedOnly
                ? 'bg-white border-t border-x border-slate-200 text-emerald-700 font-extrabold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Toolbar: Marketer, Channel, Buyer Type, Date Range & Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-emerald-600" />
            <span>এডমিন ফিল্টার ও অনুসন্ধান প্যানেল (Admin Filters)</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ফিল্টার রিসেট</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Marketer Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              দায়িত্বপ্রাপ্ত মার্কেটার
            </label>
            <select
              value={selectedMarketer}
              onChange={(e) => setSelectedMarketer(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল মার্কেটার (All)</option>
              {marketers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              সোর্স চ্যানেল
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল চ্যানেল (All)</option>
              <option value="ফেসবুক বিজ্ঞাপন">ফেসবুক বিজ্ঞাপন (FB Ads)</option>
              <option value="ফেসবুক গ্রুপ">ফেসবুক গ্রুপ / পোস্ট</option>
              <option value="গুগল বিজ্ঞাপন">গুগল বিজ্ঞাপন (Google Ads)</option>
              <option value="হোয়াটসঅ্যাপ">হোয়াটসঅ্যাপ (WhatsApp)</option>
              <option value="সরাসরি ফোন">সরাসরি ফোন কল</option>
              <option value="রেফারেল">রেফারেল (Referral)</option>
              <option value="ইউটিউব">ইউটিউব (YouTube)</option>
            </select>
          </div>

          {/* Buyer Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              ক্রেতার ধরন
            </label>
            <select
              value={selectedBuyerType}
              onChange={(e) => setSelectedBuyerType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="ALL">সকল ধরন (All Types)</option>
              <option value="RETAIL">খুচরা (Retail)</option>
              <option value="FARMER">কৃষক (Farmer)</option>
              <option value="WHOLESALER">পাইকার (Wholesaler)</option>
              <option value="RESTAURANT">রেস্টুরেন্ট (Restaurant)</option>
              <option value="DEALER">ডিলার (Dealer)</option>
              <option value="OTHER">অন্যান্য (Other)</option>
            </select>
          </div>

          {/* Date Range: Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>শুরুর তারিখ</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Date Range: End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>শেষ তারিখ</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md pt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="নাম, ফোন বা চ্যানেল দিয়ে অনুসন্ধান..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">লিড লোড হচ্ছে...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <UserPlus className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো লিড রেকর্ড পাওয়া যায়নি</p>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="mt-3 text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
              >
                ফিল্টার রিসেট করে পুনরায় দেখুন
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">ক্রেতার নাম ও মোবাইল (এডমিন আনমাস্কড)</th>
                  <th className="py-3 px-4">দায়িত্বপ্রাপ্ত মার্কেটার</th>
                  <th className="py-3 px-4">ক্রেতার ধরন ও রেটিং</th>
                  <th className="py-3 px-4">পণ্য ও চ্যানেল</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                  <th className="py-3 px-4 text-right">মূল্য (৳)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      l.is_unfinished ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    {/* Customer Name & Full Phone Number */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openDetail(l.id)}
                          className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left cursor-pointer"
                        >
                          {l.name}
                        </button>
                        {l.is_unfinished && (
                          <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.2 text-[10px] font-bold">
                            {l.days_since_update} দিন অপেক্ষমাণ
                          </span>
                        )}
                      </div>

                      {/* Admin Full Phone Number View */}
                      <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-slate-800">
                        <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                        <a
                          href={`tel:${l.phone || l.masked_phone}`}
                          className="hover:underline text-emerald-800 font-semibold"
                        >
                          {l.phone || l.masked_phone}
                        </a>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.2 rounded">
                          সম্পূর্ণ নম্বর
                        </span>
                      </div>
                    </td>

                    {/* Marketer */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span>{l.owner_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{l.owner_email}</div>
                    </td>

                    {/* Buyer Type & Quality Rating */}
                    <td className="py-3.5 px-4 text-xs space-y-1.5">
                      <div>{getBuyerTypeBadge(l.buyer_type)}</div>
                      <div>{renderQualityStars(l.quality_rating)}</div>
                    </td>

                    {/* Product & Channel */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {l.product ? l.product.name_bn : '—'}
                      </div>
                      <div className="text-[11px] text-slate-500">{l.source_channel}</div>
                      {l.campaign && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          {l.campaign.name}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(l.status)}
                    </td>

                    {/* Value */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs">
                      {l.status === 'ORDERED' && l.order_amount ? (
                        <span className="font-bold text-emerald-700">
                          ৳ {l.order_amount.toLocaleString('en-IN')}
                        </span>
                      ) : l.expected_value ? (
                        <span className="text-slate-600">
                          ৳ {l.expected_value.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => {
                          setStatusLead(l);
                          setTargetStatus(l.status);
                          setStatusQualityRating(l.quality_rating || '');
                          setOrderAmount(l.order_amount ? String(l.order_amount) : '');
                          setLostReason(l.lost_reason || '');
                          setStatusError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <span>স্টেজ পরিবর্তন</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>

                      <button
                        onClick={() => openDetail(l.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3 text-slate-500" />
                        <span>নোট ({l.notes_count})</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Detail Drawer */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">লিড ও অডিট বিবরণ (Lead Details)</h3>
                <button
                  onClick={() => {
                    setSelectedLeadId(null);
                    setLeadDetail(null);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 text-base font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {detailLoading || !leadDetail ? (
                <div className="py-12 flex justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="py-4 space-y-4 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{leadDetail.name}</span>
                      {getStatusBadge(leadDetail.status)}
                    </div>

                    {/* Admin Full Phone View */}
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2 font-mono text-sm text-emerald-800 font-bold">
                        <Phone className="h-4 w-4 text-emerald-600" />
                        <a href={`tel:${leadDetail.phone}`} className="hover:underline">
                          {leadDetail.phone}
                        </a>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        এডমিন পূর্ণ নম্বর ভিউ
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">ক্রেতার ধরন:</span>
                        <div className="mt-0.5">{getBuyerTypeBadge(leadDetail.buyer_type)}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">কোয়ালিটি রেটিং:</span>
                        <div className="mt-0.5">{renderQualityStars(leadDetail.quality_rating)}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 pt-1 border-t border-slate-200">
                      দায়িত্বপ্রাপ্ত মার্কেটার: <strong>{leadDetail.owner_name}</strong> ({leadDetail.owner_email})
                    </div>

                    {leadDetail.address && (
                      <div className="text-xs text-slate-600">
                        ঠিকানা: {leadDetail.address}
                      </div>
                    )}

                    {leadDetail.status === 'ORDERED' && leadDetail.order_amount && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-900 font-bold">
                        অর্ডার মূল্য: ৳ {leadDetail.order_amount.toLocaleString('en-IN')}
                      </div>
                    )}

                    {leadDetail.status === 'LOST' && leadDetail.lost_reason && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-900">
                        বাতিলের কারণ: {leadDetail.lost_reason}
                      </div>
                    )}
                  </div>

                  {/* Notes Timeline */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2">ফলোআপ নোট ইতিহাস:</h4>
                    {leadDetail.notes.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">কোনো পূর্ববর্তী নোট নেই</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {leadDetail.notes.map((n) => (
                          <div key={n.id} className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs">
                            <p className="text-slate-800 leading-relaxed">{n.note}</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span>{n.author.name} ({n.author.role})</span>
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

            {/* Add Admin Note Form */}
            {leadDetail && (
              <form onSubmit={handleAddAdminNote} className="pt-4 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="এডমিন পরামর্শ বা ফলোআপ নোট লিখুন..."
                  value={adminNoteText}
                  onChange={(e) => setAdminNoteText(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Lead (Admin with phone duplicate check showing owner name) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন লিড যুক্ত করুন (Admin Lead Creation)</h3>
            <p className="text-xs text-slate-500 mb-4">সম্ভাব্য ক্রেতার তথ্য ও ডুপ্লিকেট ফোন ভেরিফিকেশনসহ লিড তৈরি করুন</p>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ক্রেতার নাম (Customer Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মো: আরিফুল ইসলাম"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {/* Mobile Phone with Admin Duplicate Check showing Owner Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মোবাইল নম্বর (১১ ডিজিট) *
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={addPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  {checkingPhone && (
                    <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                {phoneWarning && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs font-bold text-amber-900 animate-in fade-in">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{phoneWarning}</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  সঠিক ১১ ডিজিটের বাংলাদেশী নম্বর (যেমন: 017XXXXXXXX)। ডুপ্লিকেট হলে এডমিন ভিউতে বিদ্যমান লিডের মালিকের নাম প্রদর্শিত হয়।
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্রেতার ধরন (Buyer Type) *
                  </label>
                  <select
                    value={addBuyerType}
                    onChange={(e) => setAddBuyerType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="RETAIL">খুচরা (Retail)</option>
                    <option value="FARMER">কৃষক (Farmer)</option>
                    <option value="WHOLESALER">পাইকার (Wholesaler)</option>
                    <option value="RESTAURANT">রেস্টুরেন্ট (Restaurant)</option>
                    <option value="DEALER">ডিলার (Dealer)</option>
                    <option value="OTHER">অন্যান্য (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    কোয়ালিটি রেটিং (১-৫ স্টার)
                  </label>
                  <div className="flex items-center gap-1 py-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setAddQualityRating(star === addQualityRating ? '' : star)
                        }
                        className="p-1 cursor-pointer transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            addQualityRating && star <= addQualityRating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                    {addQualityRating && (
                      <span className="text-xs font-bold text-amber-700 ml-1">
                        {addQualityRating}★
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আগ্রহের পণ্য
                  </label>
                  <select
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">-- নির্বাচন করুন --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name_bn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্যাম্পেইন
                  </label>
                  <select
                    value={addCampaignId}
                    onChange={(e) => setAddCampaignId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">-- নির্বাচন করুন --</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সোর্স চ্যানেল (Source Channel) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: ফেসবুক বিজ্ঞাপন, রেফারেল"
                    value={addSource}
                    onChange={(e) => setAddSource(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সম্ভাব্য বিক্রয় মূল্য (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={addExpectedValue}
                    onChange={(e) => setAddExpectedValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ঠিকানা বা এলাকা
                </label>
                <input
                  type="text"
                  placeholder="উপজেলা, জেলা"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরবর্তী ফলোআপের তারিখ
                </label>
                <input
                  type="date"
                  value={addNextFollowup}
                  onChange={(e) => setAddNextFollowup(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রাথমিক ফলোআপ নোট
                </label>
                <textarea
                  rows={2}
                  placeholder="ক্রেতার আগ্রহ ও প্রাথমিক কথোপকথন..."
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {addSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'লিড সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Transition & Quality Rating Update */}
      {statusLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              লিডের স্টেজ বা পর্যায় পরিবর্তন
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ক্রেতা: <strong className="text-slate-800">{statusLead.name}</strong> ({statusLead.phone || statusLead.masked_phone})
            </p>

            {statusError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নতুন স্ট্যাটাস (Stage) *
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => {
                    setTargetStatus(e.target.value as LeadStatus);
                    setStatusError(null);
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="NEW">নতুন (New)</option>
                  <option value="CONTACTED">যোগাযোগকৃত (Contacted)</option>
                  <option value="QUALIFIED">যোগ্য / পছন্দ (Qualified)</option>
                  <option value="ORDERED">অর্ডার সম্পন্ন (Ordered)</option>
                  <option value="LOST">বাতিল (Lost)</option>
                </select>
              </div>

              {/* Quality Rating Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কোয়ালিটি রেটিং (১-৫ স্টার)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setStatusQualityRating(star === statusQualityRating ? '' : star)
                      }
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          statusQualityRating && star <= statusQualityRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                  {statusQualityRating && (
                    <span className="text-xs font-bold text-amber-700 ml-1">
                      {statusQualityRating}★
                    </span>
                  )}
                </div>
              </div>

              {/* Acceptance Test 13: Order Amount required if ORDERED */}
              {targetStatus === 'ORDERED' && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-emerald-950">
                    নিশ্চিত অর্ডার বিক্রয় মূল্য (Order Amount ৳) *
                  </label>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      placeholder="যেমন: 5000"
                      value={orderAmount}
                      onChange={(e) => setOrderAmount(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white py-2 pl-9 pr-3 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium">
                    * নিয়ম: অর্ডার সম্পন্ন (ORDERED) করার জন্য ধনাত্মক বিক্রয় মূল্য প্রদান করা বাধ্যতামূলক।
                  </p>
                </div>
              )}

              {/* Acceptance Test 13: Lost Reason required if LOST */}
              {targetStatus === 'LOST' && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-950">
                    বাতিল হওয়ার কারণ (Lost Reason) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="যেমন: পণ্যের দাম বেশি মনে হয়েছে / অন্য ব্র্যান্ড থেকে কিনেছেন..."
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full rounded-xl border border-rose-300 bg-white p-2.5 text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-rose-800 font-medium">
                    * নিয়ম: বাতিল (LOST) করার কারণ উল্লেখ করা বাধ্যতামূলক।
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusLead(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {statusSubmitting ? 'আপডেট হচ্ছে...' : 'স্ট্যাটাস আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
