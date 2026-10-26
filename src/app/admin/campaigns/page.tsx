'use client';

import { useLanguage } from '@/components/LanguageContext';
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
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';

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
  const { lang, L } = useLanguage();
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
        setErrorMessage(data.error || L('ক্যাম্পেইন লোড করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
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
        setSuccessMessage(L('নতুন মার্কেটিং ক্যাম্পেইন তৈরি হয়েছে'));
        setIsAddOpen(false);
        setName('');
        setBudget('');
        fetchCampaigns();
      } else {
        setErrorMessage(data.error || L('ক্যাম্পেইন তৈরি ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
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
        setSuccessMessage(L('ক্যাম্পেইনের তথ্য ও বাজেট সফলভাবে আপডেট করা হয়েছে'));
        setEditingCampaign(null);
        fetchCampaigns();
      } else {
        setErrorMessage(data.error || L('আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'FACEBOOK_GROUP':
        return <span className="badge badge-blue">FB Group</span>;
      case 'FACEBOOK_AD':
        return <span className="badge badge-violet">FB Ad</span>;
      case 'GOOGLE_AD':
        return <span className="badge badge-amber">Google Ad</span>;
      case 'YOUTUBE':
        return <span className="badge badge-red">YouTube</span>;
      default:
        return <span className="badge badge-gray">{L('অন্যান্য', 'Other')}</span>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'RUNNING':
        return (
          <span className="badge badge-green">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {L('চলমান', 'Running')}
          </span>
        );
      case 'PLANNED':
        return <span className="badge badge-blue">{L('পরিকল্পিত', 'Planned')}</span>;
      case 'PAUSED':
        return <span className="badge badge-amber">{L('স্থগিত', 'Paused')}</span>;
      case 'ENDED':
        return <span className="badge badge-gray">{L('সমাপ্ত', 'Ended')}</span>;
      default:
        return null;
    }
  };

  const getBudgetStatusBadge = (status: 'SAFE' | 'WARNING' | 'EXCEEDED', pct: number) => {
    switch (status) {
      case 'EXCEEDED':
        return <span className="badge badge-red">{L('অতিক্রান্ত', 'Over')} · {pct}%</span>;
      case 'WARNING':
        return <span className="badge badge-amber">{L('সতর্কতা', 'Warning')} · {pct}%</span>;
      case 'SAFE':
      default:
        return <span className="badge badge-green">{L('নিরাপদ', 'OK')} · {pct}%</span>;
    }
  };

  const getRoasBadge = (roas: number) => {
    if (roas >= 3.0) {
      return <span className="badge badge-green tabular-nums">{roas.toFixed(2)}x</span>;
    }
    if (roas >= 1.5) {
      return <span className="badge badge-blue tabular-nums">{roas.toFixed(2)}x</span>;
    }
    if (roas > 0) {
      return <span className="badge badge-amber tabular-nums">{roas.toFixed(2)}x</span>;
    }
    return <span className="badge badge-gray tabular-nums">0.00x</span>;
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

  const channelOptions = (
    <>
      <option value="FACEBOOK_AD">Facebook Ad</option>
      <option value="FACEBOOK_GROUP">Facebook Group</option>
      <option value="GOOGLE_AD">Google Ad</option>
      <option value="YOUTUBE">YouTube</option>
      <option value="OTHER">{L('অন্যান্য', 'Other')}</option>
    </>
  );

  const statusOptions = (
    <>
      <option value="RUNNING">{L('চলমান', 'Running')}</option>
      <option value="PLANNED">{L('পরিকল্পিত', 'Planned')}</option>
      <option value="PAUSED">{L('স্থগিত', 'Paused')}</option>
      <option value="ENDED">{L('সমাপ্ত', 'Ended')}</option>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Megaphone className="h-5 w-5" />}
        title={L('ক্যাম্পেইন', 'Campaigns')}
        subtitle="Budget, ad spend and ROAS per campaign"
        actions={
          <button
            onClick={() => {
              setIsAddOpen(true);
              setErrorMessage(null);
            }}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {L('নতুন ক্যাম্পেইন', 'New campaign')}
          </button>
        }
      />

      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{L(errorMessage)}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon h-6 w-6" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{L(successMessage)}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon h-6 w-6" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {alertCampaigns.length > 0 && (
        <div
          className={`alert ${
            alertCampaigns.some((c) => c.budget_status === 'EXCEEDED') ? 'alert-error' : 'alert-warning'
          }`}
        >
          {alertCampaigns.some((c) => c.budget_status === 'EXCEEDED') ? (
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {L('বাজেট সতর্কতা', 'Budget alert')} · {alertCampaigns.length} {L('টি ক্যাম্পেইন বাজেট ছুঁয়েছে বা ছাড়িয়েছে', 'campaign(s) at or over budget')}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs">
              {alertCampaigns.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{c.name}:</span> {c.warning_message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label={L('মোট ক্যাম্পেইন', 'Total')}
            value={summary.total_campaigns}
            icon={<Megaphone className="h-4 w-4" />}
            tone="blue"
          />
          <StatCard
            label={L('সক্রিয়', 'Running')}
            value={summary.active_campaigns}
            icon={<Zap className="h-4 w-4" />}
          />
          <StatCard
            label={L('মোট বাজেট', 'Budget')}
            value={`৳ ${summary.total_budget.toLocaleString('en-IN')}`}
            icon={<DollarSign className="h-4 w-4" />}
            tone="gray"
          />
          <StatCard
            label={L('অ্যাড স্পেন্ড', 'Spend')}
            value={`৳ ${summary.total_spend.toLocaleString('en-IN')}`}
            note={`${summary.total_budget > 0 ? ((summary.total_spend / summary.total_budget) * 100).toFixed(1) : 0}% of budget`}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="violet"
          />
          <StatCard
            label={L('রাজস্ব', 'Revenue')}
            value={`৳ ${summary.total_revenue.toLocaleString('en-IN')}`}
            icon={<Package className="h-4 w-4" />}
          />
          <StatCard
            label="ROAS"
            value={`${summary.overall_roas.toFixed(2)}x`}
            note="Revenue / Ad spend"
            icon={<PieChart className="h-4 w-4" />}
            tone="violet"
          />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{L('সব ক্যাম্পেইন', 'All campaigns')}</h2>
            <p className="card-subtitle">{filteredCampaigns.length} shown</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="filter_channel" className="sr-only">Channel</label>
            <select
              id="filter_channel"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="input w-full py-1.5 text-xs sm:w-auto"
            >
              <option value="ALL">{L('সব চ্যানেল', 'All channels')}</option>
              {channelOptions}
            </select>
            <label htmlFor="filter_status" className="sr-only">Status</label>
            <select
              id="filter_status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input w-full py-1.5 text-xs sm:w-auto"
            >
              <option value="ALL">{L('সব স্ট্যাটাস', 'All statuses')}</option>
              {statusOptions}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {L('লোড হচ্ছে', 'Loading…')}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-5 w-5" />}
              title={L('কোনো ক্যাম্পেইন নেই', 'No campaigns')}
              description="Create a campaign or change the filters."
            />
          ) : (
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{L('ক্যাম্পেইন', 'Campaign')}</th>
                  <th>{L('চ্যানেল', 'Channel')}</th>
                  <th>{L('পণ্য', 'Product')}</th>
                  <th className="text-right">{L('বাজেট', 'Budget')}</th>
                  <th>{L('খরচ', 'Spend')}</th>
                  <th className="text-right">{L('রাজস্ব', 'Revenue')}</th>
                  <th className="text-center">ROAS</th>
                  <th className="text-center">{L("লিড / অর্ডার")}</th>
                  <th className="text-center">{L('স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="min-w-[180px]">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(c.start_date), 'dd MMM yyyy')}</span>
                        {c.end_date && <span>– {format(new Date(c.end_date), 'dd MMM yyyy')}</span>}
                      </div>
                    </td>

                    <td className="whitespace-nowrap">{getChannelBadge(c.channel)}</td>

                    <td className="whitespace-nowrap text-slate-600">
                      {c.product ? c.product.name_bn : <span className="text-slate-400">{L('সকল পণ্য', 'All')}</span>}
                    </td>

                    <td className="whitespace-nowrap text-right tabular-nums text-slate-900">
                      {L("৳")} {c.budget_amount.toLocaleString('en-IN')}
                    </td>

                    <td className="whitespace-nowrap">
                      <div className="flex items-center justify-between gap-3">
                        <span className="tabular-nums font-medium text-slate-900">
                          {L("৳")} {c.spend.toLocaleString('en-IN')}
                        </span>
                        {getBudgetStatusBadge(c.budget_status, c.spend_percentage)}
                      </div>
                      <div className="mt-1.5 h-1 w-full min-w-[140px] overflow-hidden rounded-full bg-slate-100">
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
                    </td>

                    <td className="whitespace-nowrap text-right tabular-nums font-medium text-slate-900">
                      {L("৳")} {c.revenue.toLocaleString('en-IN')}
                    </td>

                    <td className="whitespace-nowrap text-center">{getRoasBadge(c.roas)}</td>

                    <td className="whitespace-nowrap text-center tabular-nums">
                      <span className="text-slate-900">{c.leads_count}</span>
                      <span className="text-slate-400"> / {c.orders_count || 0}</span>
                    </td>

                    <td className="whitespace-nowrap text-center">{getStatusBadge(c.status)}</td>

                    <td className="whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="btn-icon"
                        aria-label="Edit campaign"
                        title={L('সম্পাদনা', 'Edit')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Add Campaign */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">{L('নতুন ক্যাম্পেইন', 'New campaign')}</h3>
              <button type="button" onClick={() => setIsAddOpen(false)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="camp_name">{L('নাম', 'Name *')}</label>
                  <input
                    id="camp_name"
                    type="text"
                    required
                    placeholder={L("যেমন: মাশরুম পাইকারি বুস্ট")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="camp_channel">{L('চ্যানেল', 'Channel *')}</label>
                    <select
                      id="camp_channel"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value as CampaignItem['channel'])}
                      className="input"
                    >
                      {channelOptions}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="camp_product">{L('পণ্য', 'Product')}</label>
                    <select
                      id="camp_product"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="input"
                    >
                      <option value="">{L('সকল পণ্য', 'All products')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name_bn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="camp_budget">{L('বাজেট', 'Budget (৳) *')}</label>
                    <input
                      id="camp_budget"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="15000.00"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="camp_status">{L('স্ট্যাটাস', 'Status *')}</label>
                    <select
                      id="camp_status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CampaignItem['status'])}
                      className="input"
                    >
                      {statusOptions}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="camp_start">{L('শুরু', 'Start date *')}</label>
                    <input
                      id="camp_start"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="camp_end">{L('শেষ', 'End date')}</label>
                    <input
                      id="camp_end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={addSubmitting} className="btn btn-primary">
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('তৈরি করুন', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Campaign Budget & Status */}
      {editingCampaign && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div className="min-w-0">
                <h3 className="card-title">{L('ক্যাম্পেইন আপডেট', 'Edit campaign')}</h3>
                <p className="card-subtitle truncate">{editingCampaign.name}</p>
              </div>
              <button type="button" onClick={() => setEditingCampaign(null)} className="btn-icon" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="edit_camp_name">{L('নাম', 'Name *')}</label>
                  <input
                    id="edit_camp_name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit_camp_channel">{L('চ্যানেল', 'Channel *')}</label>
                  <select
                    id="edit_camp_channel"
                    value={editChannel}
                    onChange={(e) => setEditChannel(e.target.value as CampaignItem['channel'])}
                    className="input"
                  >
                    {channelOptions}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="edit_camp_budget">{L('বাজেট', 'Budget (৳) *')}</label>
                  <input
                    id="edit_camp_budget"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    className="input tabular-nums"
                  />
                  <p className="hint">
                    {L('বর্তমান খরচ', 'Current spend')}{L(": ৳")}{editingCampaign.spend.toLocaleString('en-IN')}
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="edit_camp_status">{L('স্ট্যাটাস', 'Status *')}</label>
                  <select
                    id="edit_camp_status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CampaignItem['status'])}
                    className="input"
                  >
                    {statusOptions}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingCampaign(null)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} className="btn btn-primary">
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('সংরক্ষণ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
