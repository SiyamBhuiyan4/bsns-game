'use client';

import { useLanguage } from '@/components/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Edit2,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

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
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
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
      <PageHeader
        icon={<Package className="h-5 w-5" />}
        title={L('পণ্য ও মূল্য তালিকা', 'Products')}
        subtitle="Selling price and unit for each product"
        actions={
          <button
            onClick={() => {
              setIsAddOpen(true);
              setAddError(null);
              setErrorMessage(null);
            }}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {L('নতুন পণ্য', 'Add product')}
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
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon h-6 w-6" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {L('লোড হচ্ছে', 'Loading…')}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={L('কোনো পণ্য নেই', 'No products yet')}
            description="Add your first product to start recording sales."
          />
        ) : (
          <table className="table-pro">
            <thead>
              <tr>
                <th>{L('পণ্য', 'Product')}</th>
                <th>{L('একক', 'Unit')}</th>
                <th className="text-right">{L('মূল্য', 'Price')}</th>
                <th className="text-center">{L('স্ট্যাটাস', 'Status')}</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-slate-900">{p.name_bn}</div>
                    <div className="text-xs text-slate-500">{p.name_en}</div>
                  </td>
                  <td className="text-slate-600">প্রতি {p.unit}</td>
                  <td className="text-right font-medium tabular-nums text-slate-900">
                    ৳ {Number(p.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      disabled={togglingId === p.id}
                      onClick={() => handleToggleActive(p)}
                      title={p.is_active ? 'Click to deactivate' : 'Click to activate'}
                      className="cursor-pointer disabled:opacity-50"
                    >
                      {togglingId === p.id ? (
                        <span className="badge badge-gray">
                          <Loader2 className="h-3 w-3 animate-spin" /> Updating…
                        </span>
                      ) : p.is_active ? (
                        <span className="badge badge-green">{L('সক্রিয়', 'Active')}</span>
                      ) : (
                        <span className="badge badge-gray">{L('নিষ্ক্রিয়', 'Inactive')}</span>
                      )}
                    </button>
                  </td>
                  <td className="text-right">
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
                      className="btn-icon"
                      aria-label="Edit product"
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

      {/* Modal: Add Product */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div>
                <h3 className="card-title">{L('নতুন পণ্য', 'Add product')}</h3>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="btn-icon" aria-label="Close">
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

                <div>
                  <label className="label" htmlFor="add_name_bn">{L('বাংলা নাম', 'Bangla name *')}</label>
                  <input
                    id="add_name_bn"
                    type="text"
                    required
                    placeholder="যেমন: মাশরুম"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="add_name_en">{L('ইংরেজি নাম', 'English name *')}</label>
                  <input
                    id="add_name_en"
                    type="text"
                    required
                    placeholder="e.g. Mushroom"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="add_unit">{L('একক', 'Unit *')}</label>
                    <input
                      id="add_unit"
                      type="text"
                      required
                      placeholder="kg, packet"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="add_price">{L('মূল্য', 'Price (৳) *')}</label>
                    <input
                      id="add_price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="500.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="input tabular-nums"
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
                  {L('যুক্ত করুন', 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product */}
      {editingProduct && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="card-header">
              <div>
                <h3 className="card-title">{L('পণ্য সম্পাদনা', 'Edit product')}</h3>
              </div>
              <button type="button" onClick={() => setEditingProduct(null)} className="btn-icon" aria-label="Close">
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

                <div>
                  <label className="label" htmlFor="edit_name_bn">{L('বাংলা নাম', 'Bangla name *')}</label>
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
                  <label className="label" htmlFor="edit_name_en">{L('ইংরেজি নাম', 'English name *')}</label>
                  <input
                    id="edit_name_en"
                    type="text"
                    required
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="edit_unit">{L('একক', 'Unit *')}</label>
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
                    <label className="label" htmlFor="edit_price">{L('মূল্য', 'Price (৳) *')}</label>
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
