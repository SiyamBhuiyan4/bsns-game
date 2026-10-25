'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Tag,
} from 'lucide-react';

interface ProductItem {
  id: string;
  name_bn: string;
  name_en: string;
  unit: string;
  selling_price: string | number;
  is_active: boolean;
  created_at: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Add Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Deep link from the assistant: ?add=1 opens the add form.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') setIsAddOpen(true);
  }, []);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [editNameBn, setEditNameBn] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
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
        setErrorMessage(data.error || 'পণ্য লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
          `"${product.name_bn}" পণ্যটি ${!product.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`
        );
        fetchProducts();
      } else {
        setErrorMessage(data.error || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
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
      setAddError('বিক্রয়মূল্য অবশ্যই ০ এর বেশি হতে হবে');
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
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('নতুন পণ্য সফলভাবে যুক্ত হয়েছে');
        setIsAddOpen(false);
        setNameBn('');
        setNameEn('');
        setPrice('');
        fetchProducts();
      } else {
        setAddError(data.error || 'পণ্য তৈরি ব্যর্থ হয়েছে');
      }
    } catch {
      setAddError('নেটওয়ার্ক ত্রুটি');
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
      setEditError('বিক্রয়মূল্য অবশ্যই ০ এর বেশি হতে হবে');
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
          is_active: editActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('পণ্য তথ্য আপডেট সফল হয়েছে');
        setEditingProduct(null);
        fetchProducts();
      } else {
        setEditError(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setEditError('নেটওয়ার্ক ত্রুটি');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-600" />
            পণ্য ক্যাটালগ ও মূল্য তালিকা (Products Catalog)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            মাশরুম, গ্যানোডার্মা পাউডার ও অন্যান্য কৃষিপণ্যের বিক্রয়মূল্য ও পরিমাপের একক নির্ধারণ করুন।
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setAddError(null);
            setErrorMessage(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন পণ্য যোগ করুন (Add Product)</span>
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
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">পণ্য তালিকা লোড হচ্ছে...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো পণ্য পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">পণ্যের নাম (Bengali & English)</th>
                  <th className="py-3 px-4">একক (Unit)</th>
                  <th className="py-3 px-4 text-right">বিক্রয়মূল্য (Selling Price)</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস (Status)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900">{p.name_bn}</div>
                      <div className="text-xs text-slate-500 font-medium">{p.name_en}</div>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                        <Tag className="h-3 w-3 text-slate-500" />
                        প্রতি {p.unit}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      ৳ {Number(p.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        disabled={togglingId === p.id}
                        onClick={() => handleToggleActive(p)}
                        title={p.is_active ? 'নিষ্ক্রিয় করতে ক্লিক করুন (Click to deactivate)' : 'সক্রিয় করতে ক্লিক করুন (Click to activate)'}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 hover:scale-105"
                      >
                        {togglingId === p.id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 border border-slate-200">
                            <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> পরিবর্তন হচ্ছে...
                          </span>
                        ) : p.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                            <CheckCircle className="h-3 w-3 text-emerald-600" /> সক্রিয়
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-200">
                            <XCircle className="h-3 w-3 text-slate-400" /> নিষ্ক্রিয়
                          </span>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setEditNameBn(p.name_bn);
                          setEditNameEn(p.name_en);
                          setEditUnit(p.unit);
                          setEditPrice(String(p.selling_price));
                          setEditActive(p.is_active);
                          setEditError(null);
                          setErrorMessage(null);
                        }}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="সম্পাদনা করুন"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Product */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন পণ্য যোগ করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Add agricultural/food product</p>

            {addError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাংলা নাম (Bengali Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মাশরুম, গ্যানোডার্মা পাউডার"
                  value={nameBn}
                  onChange={(e) => setNameBn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইংরেজি নাম (English Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mushroom, Ganoderma Powder"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    একক (Unit) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="kg, packet, bottle"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বিক্রয়মূল্য (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="500.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
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
                  যুক্ত করুন (Add)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">পণ্য সম্পাদনা করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Edit Product Information</p>

            {editError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাংলা নাম *
                </label>
                <input
                  type="text"
                  required
                  value={editNameBn}
                  onChange={(e) => setEditNameBn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইংরেজি নাম *
                </label>
                <input
                  type="text"
                  required
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    একক *
                  </label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বিক্রয়মূল্য (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_prod_active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_prod_active" className="text-xs font-semibold text-slate-700">
                  পণ্যটি সক্রিয় রাখুন (Keep Active)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
                  সংরক্ষণ করুন (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
