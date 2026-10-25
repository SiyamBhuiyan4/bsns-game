'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Users,
  Search,
} from 'lucide-react';

interface Section {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  total_links: number;
  active_links: number;
  assigned_employees: number;
  created_at: string;
}

export default function SectionsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createActive, setCreateActive] = useState(true);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Modal
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete/Deactivate Confirmation
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
      } else {
        setErrorMessage(data.error || 'সেকশন তালিকা লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createName.trim().length < 2) {
      setErrorMessage('সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)');
      return;
    }

    setCreateSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || undefined,
          is_active: createActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('নতুন সেকশন সফলভাবে তৈরি হয়েছে (Section created successfully)');
        setIsCreateOpen(false);
        setCreateName('');
        setCreateDesc('');
        setCreateActive(true);
        fetchSections();
      } else {
        setErrorMessage(data.error || 'সেকশন তৈরি ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    if (editName.trim().length < 2) {
      setErrorMessage('সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)');
      return;
    }

    setEditSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/sections/${editingSection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          is_active: editActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('সেকশন তথ্য সফলভাবে আপডেট হয়েছে (Section updated)');
        setEditingSection(null);
        fetchSections();
      } else {
        setErrorMessage(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleActive = async (sec: Section) => {
    setTogglingId(sec.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/sections/${sec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !sec.is_active }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`সেকশন "${sec.name}" ${!sec.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`);
        fetchSections();
      } else {
        setErrorMessage(data.error || 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteOrDeactivate = async () => {
    if (!deleteSection) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    // If section has active links or total links, trigger deactivation instead
    if (deleteSection.active_links > 0 || deleteSection.total_links > 0) {
      try {
        const res = await fetch(`/api/admin/sections/${deleteSection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMessage('সেকশনটি সফলভাবে নিষ্ক্রিয় করা হয়েছে (Deactivated)');
          setDeleteSection(null);
          fetchSections();
        } else {
          setDeleteError(data.error || 'নিষ্ক্রিয়করণ ব্যর্থ হয়েছে');
        }
      } catch {
        setDeleteError('নেটওয়ার্ক ত্রুটি');
      } finally {
        setDeleteSubmitting(false);
      }
      return;
    }

    // Zero links: delete allowed
    try {
      const res = await fetch(`/api/admin/sections/${deleteSection.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('সেকশনটি সফলভাবে মুছে ফেলা হয়েছে (Deleted)');
        setDeleteSection(null);
        fetchSections();
      } else {
        setDeleteError(data.error || 'ডিলিট ব্যর্থ হয়েছে');
      }
    } catch {
      setDeleteError('নেটওয়ার্ক ত্রুটি');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredSections = sections.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-600" />
            গ্রুপ সেকশন ব্যবস্থাপনা (Group Sections)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            ফেসবুক ও সোশ্যাল মার্কেটিং গ্রুপ সেকশন তৈরি, লিংক আপলোড এবং পর্যবেক্ষণ করুন।
          </p>
        </div>
        <button
          onClick={() => {
            setIsCreateOpen(true);
            setErrorMessage(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন সেকশন যোগ করুন (Add Section)</span>
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

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">মোট সেকশন</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{sections.length} টি</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">সক্রিয় সেকশন</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {sections.filter((s) => s.is_active).length} টি
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">মোট গ্রুপ লিংক</div>
          <div className="mt-1 text-2xl font-bold text-blue-600">
            {sections.reduce((acc, s) => acc + s.total_links, 0)} টি
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">সক্রিয় লিংক</div>
          <div className="mt-1 text-2xl font-bold text-teal-600">
            {sections.reduce((acc, s) => acc + s.active_links, 0)} টি
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="সেকশনের নাম বা বিবরণ দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
        <Link
          href="/admin/csv/history"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Upload className="h-3.5 w-3.5 text-slate-500" />
          <span>আপলোড ইতিহাস দেখুন (View Upload History)</span>
        </Link>
      </div>

      {/* Sections Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">সেকশন তালিকা লোড হচ্ছে...</p>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো সেকশন পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'অনুসন্ধানের সাথে কোনো সেকশন মেলেনি' : 'নতুন সেকশন যোগ করতে উপরের বাটনে ক্লিক করুন'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">সেকশনের নাম (Section Name)</th>
                  <th className="py-3 px-4">বিবরণ (Description)</th>
                  <th className="py-3 px-4 text-center">গ্রুপ লিংক (Links)</th>
                  <th className="py-3 px-4 text-center">অ্যাসাইন কর্মী (Marketers)</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস (Status)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSections.map((sec) => (
                  <tr key={sec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                      <Link
                        href={`/admin/sections/${sec.id}`}
                        className="hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                      >
                        {sec.name}
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {sec.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-slate-800">{sec.active_links}</span>
                      <span className="text-xs text-slate-400"> / {sec.total_links}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        <Users className="h-3 w-3 text-slate-500" />
                        {sec.assigned_employees} জন
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sec)}
                        disabled={togglingId === sec.id}
                        title={sec.is_active ? 'নিষ্ক্রিয় করতে ক্লিক করুন (Click to deactivate)' : 'সক্রিয় করতে ক্লিক করুন (Click to activate)'}
                        className="cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {sec.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                            {togglingId === sec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 text-emerald-600" />} সক্রিয়
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors">
                            {togglingId === sec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 text-slate-500" />} নিষ্ক্রিয়
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                      {/* Upload CSV */}
                      <Link
                        href={`/admin/sections/${sec.id}/upload`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                        title="CSV আপলোড করুন"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">CSV</span>
                      </Link>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingSection(sec);
                          setEditName(sec.name);
                          setEditDesc(sec.description || '');
                          setEditActive(sec.is_active);
                          setErrorMessage(null);
                        }}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                        title="সম্পাদনা করুন"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete or Deactivate */}
                      <button
                        onClick={() => {
                          setDeleteSection(sec);
                          setDeleteError(null);
                        }}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors"
                        title={sec.total_links > 0 ? 'নিষ্ক্রিয় করুন (Deactivate)' : 'মুছে ফেলুন (Delete)'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Section */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন গ্রুপ সেকশন তৈরি করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Create a new group section (e.g. Agro Groups)</p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সেকশনের নাম (Section Name) *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="যেমন: Agro Groups, Restaurant Groups"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিবরণ (Description)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="এই সেকশনের উদ্দেশ্য বা বিবরণ লিখুন..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create_is_active"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="create_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  সেকশনটি সরাসরি সক্রিয় রাখুন (Keep Active by default)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {createSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  তৈরি করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Section */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">সেকশন সম্পাদনা করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Edit Section Details</p>

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সেকশনের নাম (Section Name) *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিবরণ (Description)
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_is_active" className="text-xs font-semibold text-slate-700">
                  সেকশনটি সক্রিয় রাখুন (Keep Active)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSection(null)}
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

      {/* Confirmation Modal: Delete / Deactivate */}
      {deleteSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-3 text-rose-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">
                {deleteSection.total_links > 0 ? 'সেকশন নিষ্ক্রিয়করণ (Deactivate)' : 'সেকশন ডিলিট (Delete)'}
              </h3>
            </div>

            {deleteError && (
              <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
                {deleteError}
              </div>
            )}

            {deleteSection.total_links > 0 ? (
              <div className="space-y-2 text-sm text-slate-600">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium leading-relaxed">
                  ⚠️ <strong>
                    {deleteSection.active_links > 0
                      ? `এই section-এ ${deleteSection.active_links}টি সক্রিয় লিংক (মোট ${deleteSection.total_links}টি লিংক) আছে, তাই delete করা যাবে না। Deactivate করুন।`
                      : `এই section-এ ${deleteSection.total_links}টি লিংক সংরক্ষিত আছে, তাই delete করা যাবে না। Deactivate করুন।`}
                  </strong>
                </div>
                <p className="text-xs text-slate-500">
                  নিষ্ক্রিয় করলে কর্মীদের টাস্ক কিউ থেকে লিংকগুলো সাময়িক বন্ধ থাকবে, তবে পূর্বের সম্পন্ন কাজের ইতিহাস অক্ষুণ্ণ থাকবে।
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                আপনি কি নিশ্চিত যে আপনি <strong>&quot;{deleteSection.name}&quot;</strong> সেকশনটি মুছে ফেলতে চান? এই সেকশনে কোনো লিংক নেই, তাই এটি নিরাপদভাবে মুছে ফেলা যাবে।
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteSection(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleDeleteOrDeactivate}
                disabled={deleteSubmitting}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white cursor-pointer ${
                  deleteSection.total_links > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {deleteSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {deleteSection.total_links > 0 ? 'নিষ্ক্রিয় করুন (Deactivate)' : 'ডিলিট করুন (Delete)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
