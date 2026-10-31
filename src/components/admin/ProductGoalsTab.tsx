'use client';

import { useLanguage } from '@/components/LanguageContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  Plus,
  Edit2,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Target,
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';

interface ProductItem {
  id: string;
  name_bn: string;
  name_en: string;
  unit: string;
  selling_price: string | number;
  target_quantity?: number;
  target_deadline?: string | null;
  target_start_date?: string | null;
  achieved_quantity?: number;
  achieved_amount?: number;
  progress_percentage?: number;
  remaining_quantity?: number;
  days_remaining?: number | null;
  daily_needed?: number;
  is_overdue?: boolean;
  is_ending_today?: boolean;
  is_completed?: boolean;
  is_active: boolean;
  created_at: string;
}

export default function ProductGoalsTab() {
  const { L } = useLanguage();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editNameBn, setEditNameBn] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editTargetQuantity, setEditTargetQuantity] = useState('');
  const [editTargetDeadline, setEditTargetDeadline] = useState('');
  const [editTargetStartDate, setEditTargetStartDate] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?all=true');
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
      } else {
        setErrorMessage(data.error || L('পণ্য লোড করা যায়নি', 'Failed to load products'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা', 'Network error'));
    } finally {
      setLoading(false);
    }
  }, [L]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Overall Target Statistics
  const targetStats = useMemo(() => {
    let totalTargetUnits = 0;
    let totalAchievedUnits = 0;
    let activeTargetsCount = 0;
    let urgentCount = 0;
    let completedCount = 0;

    for (const p of products) {
      const tQty = p.target_quantity || 0;
      const aQty = p.achieved_quantity || 0;
      if (tQty > 0) {
        activeTargetsCount++;
        totalTargetUnits += tQty;
        totalAchievedUnits += aQty;
        if (p.is_completed) {
          completedCount++;
        } else if (p.is_overdue || (p.days_remaining !== null && p.days_remaining !== undefined && p.days_remaining <= 7)) {
          urgentCount++;
        }
      }
    }

    const overallProgress = totalTargetUnits > 0 ? Math.min(100, Math.round((totalAchievedUnits / totalTargetUnits) * 100)) : 0;

    return {
      totalTargetUnits,
      totalAchievedUnits,
      activeTargetsCount,
      urgentCount,
      completedCount,
      overallProgress,
    };
  }, [products]);

  const handleToggleActive = async (product: ProductItem) => {
    setTogglingId(product.id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !product.is_active }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(
          L(
            `"${product.name_bn}" পণ্যটি ${!product.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`,
            `"${product.name_en}" status updated to ${!product.is_active ? 'Active' : 'Inactive'}`
          )
        );
        fetchProducts();
      } else {
        setErrorMessage(data.error || L('স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে', 'Status update failed'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSubmitting(true);
    setAddError(null);
    setErrorMessage(null);

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setAddError(L('বিক্রয়মূল্য অবশ্যই ০ এর বেশি হতে হবে', 'Selling price must be greater than 0'));
      setAddSubmitting(false);
      return;
    }

    const parsedTargetQty = targetQuantity ? parseFloat(targetQuantity) : 0;
    if (targetQuantity && (isNaN(parsedTargetQty) || parsedTargetQty < 0)) {
      setAddError(L('টার্গেট পরিমাণ ০ বা তার বেশি হতে হবে', 'Target quantity must be 0 or more'));
      setAddSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_bn: nameBn,
          name_en: nameEn,
          unit,
          selling_price: parsedPrice,
          target_quantity: parsedTargetQty,
          target_deadline: targetDeadline || null,
          target_start_date: targetStartDate || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('নতুন পণ্য এবং সেলস টার্গেট সফলভাবে যুক্ত হয়েছে', 'Product & target goal created successfully'));
        setIsAddOpen(false);
        setNameBn('');
        setNameEn('');
        setPrice('');
        setTargetQuantity('');
        setTargetDeadline('');
        setTargetStartDate('');
        fetchProducts();
      } else {
        setAddError(data.error || L('পণ্য তৈরি ব্যর্থ হয়েছে', 'Failed to create product'));
      }
    } catch {
      setAddError(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditSubmitting(true);
    setEditError(null);
    setErrorMessage(null);

    const parsedPrice = parseFloat(editPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setEditError(L('বিক্রয়মূল্য অবশ্যই ০ এর বেশি হতে হবে', 'Price must be greater than 0'));
      setEditSubmitting(false);
      return;
    }

    const parsedTargetQty = editTargetQuantity ? parseFloat(editTargetQuantity) : 0;
    if (editTargetQuantity && (isNaN(parsedTargetQty) || parsedTargetQty < 0)) {
      setEditError(L('টার্গেট পরিমাণ ০ বা তার বেশি হতে হবে', 'Target quantity must be 0 or more'));
      setEditSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_bn: editNameBn,
          name_en: editNameEn,
          unit: editUnit,
          selling_price: parsedPrice,
          target_quantity: parsedTargetQty,
          target_deadline: editTargetDeadline || null,
          target_start_date: editTargetStartDate || null,
          is_active: editActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('পণ্য ও সেলস টার্গেট আপডেট সফল হয়েছে', 'Product & target updated successfully'));
        setEditingProduct(null);
        fetchProducts();
      } else {
        setEditError(data.error || L('আপডেট ব্যর্থ হয়েছে', 'Update failed'));
      }
    } catch {
      setEditError(L('নেটওয়ার্ক ত্রুটি', 'Network error'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setEditNameBn(p.name_bn);
    setEditNameEn(p.name_en);
    setEditUnit(p.unit);
    setEditPrice(String(p.selling_price));
    setEditTargetQuantity(p.target_quantity ? String(p.target_quantity) : '');
    setEditTargetDeadline(p.target_deadline || '');
    setEditTargetStartDate(p.target_start_date || '');
    setEditActive(p.is_active);
    setEditError(null);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{L('প্রোডাক্ট সেলস টার্গেট ও ডেডলাইন', 'Product Sales Goals & Deadlines')}</h2>
          <p className="text-xs text-slate-500">
            {L('নির্দিষ্ট সময়সীমার মধ্যে পণ্য বিক্রির লক্ষ্যমাত্রা এবং কর্মচারীদের বাস্তব অগ্রগতি পর্যবেক্ষণ করুন', 'Track target volume, deadline countdown, and daily sales pace')}
          </p>
        </div>
        <button
          onClick={() => {
            setIsAddOpen(true);
            setAddError(null);
            setErrorMessage(null);
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" />
          {L('নতুন পণ্য ও সেলস টার্গেট', 'Add Product Goal')}
        </button>
      </div>

      {/* Target Progress Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">{L('টার্গেটভুক্ত পণ্য', 'Active Goals')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {targetStats.activeTargetsCount} <span className="text-xs font-normal text-slate-400">/ {products.length}</span>
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">{L('মোট বিক্রি অগ্রগতি', 'Overall Progress')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {targetStats.totalAchievedUnits.toLocaleString()} <span className="text-xs font-normal text-slate-400">/ {targetStats.totalTargetUnits.toLocaleString()} ({targetStats.overallProgress}%)</span>
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">{L('লক্ষ্য অর্জিত', 'Goals Completed')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {targetStats.completedCount}
            </div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">{L('ডেডলাইন সমাগত / বাকি', 'Ending Soon / Due')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">
              {targetStats.urgentCount}
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{L(errorMessage)}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon h-6 w-6" aria-label={L('বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{L(successMessage)}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon h-6 w-6" aria-label={L('বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="min-w-0">
            <h3 className="card-title">{L('পণ্য ও বিক্রয় লক্ষ্যমাত্রা তালিকা', 'Product Sales Goals')}</h3>
            <p className="card-subtitle">
              {L('নির্দিষ্ট তারিখের মধ্যে বিক্রয় সংখ্যা এবং কর্মচারীদের বাস্তব রিপোর্ট পর্যবেক্ষণ করুন', 'Track target quantity, deadline countdown, and daily sales pace')}
            </p>
          </div>
          {!loading && <span className="badge badge-gray tabular-nums">{products.length} {L('টি পণ্য', 'products')}</span>}
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={6} label={L('লোড হচ্ছে', 'Loading…')} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={L('কোনো পণ্য বা সেলস টার্গেট নেই', 'No products or targets yet')}
            description={L('নির্দিষ্ট সময়ের মধ্যে পণ্য বিক্রির লক্ষ্য নির্ধারণ করতে প্রথম পণ্যটি যোগ করুন।', 'Set up your first product sales target and deadline.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro min-w-[760px]">
              <thead>
                <tr>
                  <th>{L('পণ্য ও মূল্য', 'Product & Price')}</th>
                  <th>{L('টার্গেট লক্ষ্যমাত্রা', 'Target Goal')}</th>
                  <th>{L('অগ্রগতি', 'Progress')}</th>
                  <th>{L('ডেডলাইন ও অবস্থা', 'Deadline & Status')}</th>
                  <th className="text-center">{L('সক্রিয়তা', 'Active')}</th>
                  <th className="text-right">
                    <span className="sr-only">{L('কাজ', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const hasTarget = Boolean(p.target_quantity && p.target_quantity > 0);
                  const progress = p.progress_percentage || 0;

                  return (
                    <tr key={p.id}>
                      {/* Product Name & Price */}
                      <td>
                        <div className="font-semibold text-slate-900">{p.name_bn}</div>
                        <div className="text-xs text-slate-500">{p.name_en}</div>
                        <div className="mt-1 text-xs font-medium text-emerald-700 tabular-nums">
                          {L('৳')} {Number(p.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {p.unit}
                        </div>
                      </td>

                      {/* Target Goal */}
                      <td>
                        {hasTarget ? (
                          <div>
                            <div className="font-semibold text-slate-800 tabular-nums">
                              {p.target_quantity?.toLocaleString()} {p.unit}
                            </div>
                            <div className="text-xs text-slate-500">
                              {L('বিক্রি হয়েছে:', 'Sold:')} <span className="font-medium text-slate-700">{p.achieved_quantity?.toLocaleString() || 0} {p.unit}</span>
                            </div>
                            {p.daily_needed && p.daily_needed > 0 && !p.is_completed && !p.is_overdue ? (
                              <div className="mt-0.5 text-xs text-blue-600 font-medium">
                                ⚡ {L(`দৈনিক দরকার ~${p.daily_needed} ${p.unit}`, `Pace: ~${p.daily_needed} ${p.unit}/day`)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            onClick={() => openEditModal(p)}
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium bg-brand-50 px-2 py-1 rounded-md"
                          >
                            <Plus className="h-3 w-3" />
                            {L('টার্গেট দিন', '+ Set Target')}
                          </button>
                        )}
                      </td>

                      {/* Progress Bar & Achieved */}
                      <td className="w-48">
                        {hasTarget ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700 tabular-nums">{progress}%</span>
                              <span className="text-slate-400 tabular-nums">
                                {p.is_completed ? L('সম্পন্ন!', 'Done!') : `${p.remaining_quantity?.toLocaleString()} ${p.unit} ${L('বাকি', 'left')}`}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  p.is_completed
                                    ? 'bg-emerald-500'
                                    : progress > 60
                                    ? 'bg-blue-500'
                                    : progress > 30
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{L('টার্গেট নির্ধারণ করা নেই', 'No target set')}</span>
                        )}
                      </td>

                      {/* Deadline Countdown & Status */}
                      <td>
                        {p.target_deadline ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span className="tabular-nums">{p.target_deadline}</span>
                            </div>
                            <div>
                              {p.is_completed ? (
                                <span className="badge badge-green inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> {L('টার্গেট পূরণ!', 'Goal Met!')}
                                </span>
                              ) : p.is_overdue ? (
                                <span className="badge badge-red inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {L('সময় পার হয়েছে', 'Overdue')}
                                </span>
                              ) : p.is_ending_today ? (
                                <span className="badge badge-amber inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {L('আজ শেষ দিন!', 'Ends Today!')}
                                </span>
                              ) : (
                                <span
                                  className={`badge ${
                                    (p.days_remaining || 0) <= 3
                                      ? 'badge-amber'
                                      : 'badge-blue'
                                  } inline-flex items-center gap-1`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {L(`${p.days_remaining} দিন বাকি`, `${p.days_remaining}d remaining`)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{L('নির্দিষ্ট মেয়াদ নেই', 'No deadline')}</span>
                        )}
                      </td>

                      {/* Active Toggle */}
                      <td className="text-center">
                        <button
                          type="button"
                          disabled={togglingId === p.id}
                          onClick={() => handleToggleActive(p)}
                          title={p.is_active ? L('নিষ্ক্রিয় করতে ক্লিক করুন', 'Click to deactivate') : L('সক্রিয় করতে ক্লিক করুন', 'Click to activate')}
                          className="cursor-pointer disabled:opacity-50"
                        >
                          {togglingId === p.id ? (
                            <span className="badge badge-gray">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </span>
                          ) : p.is_active ? (
                            <span className="badge badge-green">{L('সক্রিয়', 'Active')}</span>
                          ) : (
                            <span className="badge badge-gray">{L('নিষ্ক্রিয়', 'Inactive')}</span>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="btn-icon h-8 w-8 text-slate-500 hover:text-brand-600"
                          aria-label={L('টার্গেট ও পণ্য সম্পাদনা', 'Edit target and product')}
                          title={L('সম্পাদনা', 'Edit')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Product with Target */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
            <div className="card-header">
              <div>
                <h3 id="add-product-title" className="card-title">{L('নতুন পণ্য ও সেলস টার্গেট', 'Add Product Goal')}</h3>
                <p className="card-subtitle text-xs text-slate-500">
                  {L('পণ্যের নাম, মূল্য এবং নির্ধারিত সময়ের সেলস টার্গেট লিখুন', 'Define product catalog, selling price, and milestone sales goals')}
                </p>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="btn-icon" aria-label={L('বন্ধ করুন', 'Close')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="card-body space-y-4">
                {addError && (
                  <div className="alert alert-error">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="add_name_bn">{L('বাংলা নাম *', 'Bangla Name *')}</label>
                    <input
                      id="add_name_bn"
                      type="text"
                      required
                      placeholder={L('যেমন: মাশরুম প্যাকেট', 'e.g. মাশরুম প্যাকেট')}
                      value={nameBn}
                      onChange={(e) => setNameBn(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="add_name_en">{L('ইংরেজি নাম *', 'English Name *')}</label>
                    <input
                      id="add_name_en"
                      type="text"
                      required
                      placeholder="e.g. Mushroom Packet"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="add_unit">{L('পরিমাপের একক *', 'Unit *')}</label>
                    <input
                      id="add_unit"
                      type="text"
                      required
                      placeholder="kg, packet, box"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="add_price">{L('বিক্রয়মূল্য (৳) *', 'Price (৳) *')}</label>
                    <input
                      id="add_price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="350.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>
                </div>

                {/* Sales Target & Deadline Section */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span>{L('বিক্রয় লক্ষ্যমাত্রা ও ডেডলাইন (ঐচ্ছিক)', 'Sales Target & Deadline (Optional)')}</span>
                  </div>

                  <div>
                    <label className="label text-xs" htmlFor="add_target_qty">
                      {L('টার্গেট বিক্রির পরিমাণ (কতটা বিক্রি করতে হবে)', 'Target Quantity to Sell')}
                    </label>
                    <input
                      id="add_target_qty"
                      type="number"
                      step="any"
                      min="0"
                      placeholder={L('যেমন: ৫০০', 'e.g. 500')}
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs" htmlFor="add_target_start">
                        {L('টার্গেট শুরুর তারিখ', 'Start Date')}
                      </label>
                      <input
                        id="add_target_start"
                        type="date"
                        value={targetStartDate}
                        onChange={(e) => setTargetStartDate(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label text-xs" htmlFor="add_target_deadline">
                        {L('শেষের তারিখ / ডেডলাইন', 'Deadline')}
                      </label>
                      <input
                        id="add_target_deadline"
                        type="date"
                        value={targetDeadline}
                        onChange={(e) => setTargetDeadline(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={addSubmitting} className="btn btn-primary">
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('যুক্ত করুন', 'Save Goal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product & Target */}
      {editingProduct && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
            <div className="card-header">
              <div>
                <h3 id="edit-product-title" className="card-title">{L('পণ্য ও সেলস টার্গেট সম্পাদনা', 'Edit Goal & Product')}</h3>
                <p className="card-subtitle text-xs text-slate-500">
                  {L('লক্ষ্যমাত্রা বা সময়সীমা পরিবর্তন করতে তথ্য হালনাগাদ করুন', 'Update target volume or deadline')}
                </p>
              </div>
              <button type="button" onClick={() => setEditingProduct(null)} className="btn-icon" aria-label={L('বন্ধ করুন', 'Close')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEdit}>
              <div className="card-body space-y-4">
                {editError && (
                  <div className="alert alert-error">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="edit_name_bn">{L('বাংলা নাম *', 'Bangla Name *')}</label>
                    <input
                      id="edit_name_bn"
                      type="text"
                      required
                      value={editNameBn}
                      onChange={(e) => setEditNameBn(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="edit_name_en">{L('ইংরেজি নাম *', 'English Name *')}</label>
                    <input
                      id="edit_name_en"
                      type="text"
                      required
                      value={editNameEn}
                      onChange={(e) => setEditNameEn(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="edit_unit">{L('একক *', 'Unit *')}</label>
                    <input
                      id="edit_unit"
                      type="text"
                      required
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="edit_price">{L('মূল্য (৳) *', 'Price (৳) *')}</label>
                    <input
                      id="edit_price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>
                </div>

                {/* Sales Target & Deadline Fields */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span>{L('বিক্রয় লক্ষ্যমাত্রা ও ডেডলাইন', 'Sales Target & Deadline')}</span>
                  </div>

                  <div>
                    <label className="label text-xs" htmlFor="edit_target_qty">
                      {L('টার্গেট বিক্রির পরিমাণ (০ লিখলে টার্গেট বাতিল হবে)', 'Target Quantity to Sell')}
                    </label>
                    <input
                      id="edit_target_qty"
                      type="number"
                      step="any"
                      min="0"
                      placeholder={L('যেমন: ৫০০', 'e.g. 500')}
                      value={editTargetQuantity}
                      onChange={(e) => setEditTargetQuantity(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs" htmlFor="edit_target_start">
                        {L('টার্গেট শুরুর তারিখ', 'Start Date')}
                      </label>
                      <input
                        id="edit_target_start"
                        type="date"
                        value={editTargetStartDate}
                        onChange={(e) => setEditTargetStartDate(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label text-xs" htmlFor="edit_target_deadline">
                        {L('শেষের তারিখ / ডেডলাইন', 'Deadline')}
                      </label>
                      <input
                        id="edit_target_deadline"
                        type="date"
                        value={editTargetDeadline}
                        onChange={(e) => setEditTargetDeadline(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                </div>

                <label htmlFor="edit_prod_active" className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    id="edit_prod_active"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {L('সক্রিয়', 'Active')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingProduct(null)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} className="btn btn-primary">
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {L('সংরক্ষণ করুন', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
