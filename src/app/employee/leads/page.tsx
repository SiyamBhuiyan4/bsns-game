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
} from 'lucide-react';
import { format } from 'date-fns';

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
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'ORDERED' | 'LOST';
  quality_rating: number | null;
  expected_value: number | null;
  order_amount: number | null;
  lost_reason: string | null;
  next_followup_date: string | null;
  notes_count: number;
  created_at: string;
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

  // Phone Duplicate Check Warning State (Acceptance Test 14)
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
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

  const fetchLeads = useCallback(async () => {
    try {
      let url = `/api/leads?q=${encodeURIComponent(searchQuery)}`;
      if (activeTab !== 'ALL') {
        url += `&status=${activeTab}`;
      }
      if (showUnfinishedOnly) {
        url += `&unfinished=true`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads || []);
      }
    } catch {
      setErrorMessage('লিড লোড করা যায়নি');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showUnfinishedOnly, searchQuery]);

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

  // Live Phone Duplicate Check (Acceptance Test 14)
  const handlePhoneChange = async (val: string) => {
    setAddPhone(val);
    const cleaned = val.replace(/[\s-]/g, '');
    if (cleaned.length >= 11) {
      setCheckingPhone(true);
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        if (data.exists) {
          if (data.isOwnLead) {
            setPhoneWarning('⚠️ সতর্কবার্তা: এই মোবাইল নম্বরটি ইতিমধ্যে আপনার নিজস্ব তালিকায় লিড হিসেবে যুক্ত রয়েছে');
          } else {
            setPhoneWarning('⚠️ সতর্কবার্তা: এই মোবাইল নম্বরটি ইতিমধ্যে সিস্টেমে অন্য লিড হিসেবে যুক্ত রয়েছে (অন্য কর্মীর নাম গোপন রাখা হয়েছে)');
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
        setSuccessMessage('লিড স্ট্যাটাস সফলভাবে আপডেট হয়েছে');
        setStatusLead(null);
        setOrderAmount('');
        setLostReason('');
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
        return <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-bold">নতুন (New)</span>;
      case 'CONTACTED':
        return <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-bold">যোগাযোগকৃত (Contacted)</span>;
      case 'QUALIFIED':
        return <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-bold">যোগ্য (Qualified)</span>;
      case 'ORDERED':
        return <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">অর্ডার সম্পন্ন (Ordered)</span>;
      case 'LOST':
        return <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-xs font-bold">বাতিল (Lost)</span>;
    }
  };

  const getBuyerTypeLabel = (bt: string) => {
    switch (bt) {
      case 'FARMER': return 'কৃষক (Farmer)';
      case 'WHOLESALER': return 'পাইকার (Wholesaler)';
      case 'RESTAURANT': return 'রেস্টুরেন্ট (Restaurant)';
      case 'DEALER': return 'ডিলার (Dealer)';
      case 'RETAIL': return 'খুচরা (Retail)';
      default: return 'অন্যান্য (Other)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-teal-600" />
            আমার লিড ও বিক্রয় পাইপলাইন (My Leads Pipeline)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            গ্রুপ পোস্ট ও প্রচারণার মাধ্যমে প্রাপ্ত ক্রেতার লিড সংগ্রহ, ফলোআপ ও নিশ্চিত অর্ডারে রূপান্তর করুন।
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setErrorMessage(null);
            setPhoneWarning(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন লিড যুক্ত করুন (Add Lead)</span>
        </button>
      </div>

      {/* Acceptance Test 15: Unfinished Orders Alert Box */}
      {unfinishedCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                ৩+ দিন ধরে অপেক্ষমাণ অর্ডারহীন লিড: {unfinishedCount} জন (Unfinished Orders)
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                এই ক্রেতারা &quot;পছন্দ/যোগ্য (Qualified)&quot; পর্যায়ে থাকা সত্ত্বেও গত ৩ দিনের মধ্যে কোনো অর্ডার নিশ্চিত হয়নি। এখনই ফলোআপ করুন।
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowUnfinishedOnly(!showUnfinishedOnly)}
            className="self-start sm:self-auto rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 transition-colors cursor-pointer"
          >
            {showUnfinishedOnly ? 'সকল লিড দেখুন' : 'অপেক্ষমাণ লিডগুলো ফিল্টার করুন'}
          </button>
        </div>
      )}

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

      {/* Pipeline Stage Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs font-bold">
        {[
          { key: 'ALL', label: 'সকল লিড (All)' },
          { key: 'NEW', label: 'নতুন (New)' },
          { key: 'CONTACTED', label: 'যোগাযোগকৃত (Contacted)' },
          { key: 'QUALIFIED', label: 'যোগ্য/পছন্দ (Qualified)' },
          { key: 'ORDERED', label: 'অর্ডার সম্পন্ন (Ordered)' },
          { key: 'LOST', label: 'বাতিল (Lost)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowUnfinishedOnly(false);
            }}
            className={`px-3.5 py-2 rounded-t-xl transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.key && !showUnfinishedOnly
                ? 'bg-white border-t border-x border-slate-200 text-teal-700 shadow-2xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ক্রেতার নাম, ফোন বা চ্যানেল দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>

        {showUnfinishedOnly && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 text-xs font-bold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            ৩+ দিন ধরে অপেক্ষমাণ লিড ফিল্টার সক্রিয়
          </span>
        )}
      </div>

      {/* Leads Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
            <p className="text-sm">লিড লোড হচ্ছে...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <UserPlus className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো লিড পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">ক্রেতার নাম ও মোবাইল (Masked)</th>
                  <th className="py-3 px-4">ধরন (Buyer Type)</th>
                  <th className="py-3 px-4">লক্ষ্য পণ্য</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস (Stage)</th>
                  <th className="py-3 px-4 text-right">সম্ভাব্য / অর্ডার মূল্য</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Action)</th>
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
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openDetail(l.id)}
                          className="font-semibold text-slate-900 hover:text-teal-700 hover:underline text-left cursor-pointer"
                        >
                          {l.name}
                        </button>
                        {l.is_unfinished && (
                          <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-[10px] font-bold">
                            {l.days_since_update} দিন অপেক্ষমাণ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{l.masked_phone}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {getBuyerTypeLabel(l.buyer_type)}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {l.product ? l.product.name_bn : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(l.status)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono text-xs">
                      {l.status === 'ORDERED' && l.order_amount ? (
                        <span className="font-bold text-emerald-700">
                          ৳ {l.order_amount.toLocaleString('en-IN')}
                        </span>
                      ) : l.expected_value ? (
                        <span className="text-slate-600">
                          ৳ {l.expected_value.toLocaleString('en-IN')} (সম্ভাব্য)
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => {
                          setStatusLead(l);
                          setTargetStatus(l.status);
                          setOrderAmount(l.order_amount ? String(l.order_amount) : '');
                          setLostReason(l.lost_reason || '');
                          setStatusError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors cursor-pointer"
                      >
                        <span>স্টেজ পরিবর্তন</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>

                      <button
                        onClick={() => openDetail(l.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="বিস্তারিত ও নোট দেখুন"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {l.notes_count > 0 && <span className="text-[10px] font-bold">{l.notes_count}</span>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Lead */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন লিড যুক্ত করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Add potential customer lead with verification</p>

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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              {/* Mobile Phone with Acceptance Test 14 live duplicate warning */}
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
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্রেতার ধরন (Buyer Type) *
                  </label>
                  <select
                    value={addBuyerType}
                    onChange={(e) => setAddBuyerType(e.target.value as LeadItem['buyer_type'])}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                  >
                    <option value="RETAIL">খুচরা ক্রেতা (Retail)</option>
                    <option value="WHOLESALER">পাইকার (Wholesaler)</option>
                    <option value="FARMER">কৃষক / চাষি (Farmer)</option>
                    <option value="RESTAURANT">রেস্টুরেন্ট (Restaurant)</option>
                    <option value="DEALER">ডিলার (Dealer)</option>
                    <option value="OTHER">অন্যান্য (Other)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আগ্রহী পণ্য
                  </label>
                  <select
                    value={addProductId}
                    onChange={(e) => setAddProductId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                  >
                    <option value="">পণ্য নির্বাচন করুন...</option>
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
                    সোর্স চ্যানেল *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ফেসবুক গ্রুপ / অ্যাড / কল"
                    value={addSource}
                    onChange={(e) => setAddSource(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ক্যাম্পেইন (ঐচ্ছিক)
                  </label>
                  <select
                    value={addCampaignId}
                    onChange={(e) => setAddCampaignId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                  >
                    <option value="">ক্যাম্পেইন নেই</option>
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
                    সম্ভাব্য মূল্য (Expected ৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="যেমন: 5000"
                    value={addExpectedValue}
                    onChange={(e) => setAddExpectedValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পরবর্তী ফলোআপ তারিখ
                  </label>
                  <input
                    type="date"
                    value={addNextFollowup}
                    onChange={(e) => setAddNextFollowup(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ঠিকানা (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: মিরপুর ১০, ঢাকা"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রাথমিক নোট (Initial Note)
                </label>
                <textarea
                  rows={2}
                  placeholder="ক্রেতার চাহিদা বা যোগাযোগের বিবরণ..."
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
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
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60 cursor-pointer"
                >
                  {addSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  সংরক্ষণ করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Lead Status (Acceptance Test 13) */}
      {statusLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">লিড স্ট্যাটাস পরিবর্তন করুন</h3>
            <p className="text-xs text-slate-500 mb-4">
              ক্রেতা: <strong>{statusLead.name}</strong> ({statusLead.masked_phone})
            </p>

            {statusError && (
              <div className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                {statusError}
              </div>
            )}

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নতুন স্ট্যাটাস (Stage) *
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as LeadItem['status'])}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                >
                  <option value="NEW">নতুন (NEW)</option>
                  <option value="CONTACTED">যোগাযোগকৃত (CONTACTED)</option>
                  <option value="QUALIFIED">যোগ্য/পছন্দ (QUALIFIED)</option>
                  <option value="ORDERED">অর্ডার সম্পন্ন (ORDERED)</option>
                  <option value="LOST">বাতিল (LOST)</option>
                </select>
              </div>

              {/* Acceptance Test 13: ORDERED requires order_amount */}
              {targetStatus === 'ORDERED' && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 space-y-2 animate-in fade-in">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-700" />
                    অর্ডার সম্পন্ন বিক্রয় মূল্য (Order Amount) *
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="যেমন: 2500.00 (বাধ্যতামূলক)"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-emerald-800">
                    * অর্ডার নিশ্চিত লিডের ক্ষেত্রে বিক্রয় মূল্য প্রদান করা আবশ্যক।
                  </p>
                </div>
              )}

              {/* Acceptance Test 13: LOST requires lost_reason */}
              {targetStatus === 'LOST' && (
                <div className="rounded-xl border border-rose-300 bg-rose-50/70 p-3.5 space-y-2 animate-in fade-in">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-rose-700" />
                    অর্ডার বাতিলের কারণ (Lost Reason) *
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="যেমন: মূল্য বেশি মনে হয়েছে / অন্যখান থেকে কিনেছে (বাধ্যতামূলক)"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full rounded-xl border border-rose-300 bg-white p-2.5 text-sm focus:border-rose-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-rose-800">
                    * লিড বাতিলের ক্ষেত্রে কারণ উল্লেখ করা বাধ্যতামূলক।
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusLead(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60 cursor-pointer"
                >
                  {statusSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  আপডেট করুন (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail & Notes Drawer */}
      {selectedLeadId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">লিড বিবরণ ও ফলোআপ নোট</h3>
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
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : (
                <div className="py-4 space-y-4 text-xs">
                  {/* Lead Info Box with Unmasked Phone */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">{leadDetail.name}</span>
                      {getStatusBadge(leadDetail.status)}
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs text-teal-700 font-bold bg-white p-2 rounded-lg border border-slate-200">
                      <Phone className="h-3.5 w-3.5 text-teal-600" />
                      <span>{leadDetail.phone} (সম্পূর্ণ নম্বর)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                      <div>ধরন: <strong>{getBuyerTypeLabel(leadDetail.buyer_type)}</strong></div>
                      <div>পণ্য: <strong>{leadDetail.product ? leadDetail.product.name_bn : '—'}</strong></div>
                      <div>সোর্স: <strong>{leadDetail.source_channel}</strong></div>
                      <div>ক্যাম্পেইন: <strong>{leadDetail.campaign ? leadDetail.campaign.name : '—'}</strong></div>
                    </div>

                    {leadDetail.address && (
                      <div className="text-[11px] text-slate-500 pt-1">
                        ঠিকানা: {leadDetail.address}
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

            {/* Add Note Form */}
            {leadDetail && (
              <form onSubmit={handleAddNote} className="pt-4 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="নতুন ফলোআপ নোট লিখুন..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 p-2 text-xs focus:border-teal-600 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={noteSubmitting}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
