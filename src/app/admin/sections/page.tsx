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
  AlertCircle,
  Loader2,
  Users,
  Search,
  X,
  History,
  Link as LinkIcon,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

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
  const { t } = useLanguage();
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

  // Deep links from the assistant: ?q=<search>, ?add=1, ?name=<prefill>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
    if (params.get('add') === '1') {
      setCreateName(params.get('name') ?? '');
      setIsCreateOpen(true);
    }
  }, []);

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
      <PageHeader
        icon={<Layers className="h-5 w-5" />}
        title={t('sec.title', 'গ্রুপ সেকশন', 'Group sections')}
        subtitle={t('sec.subtitle', 'সেকশন তৈরি করুন, লিংক আপলোড করুন ও অগ্রগতি দেখুন', 'Create sections, upload links and track progress')}
        actions={
          <>
            <Link href="/admin/csv/history" className="btn btn-secondary">
              <History className="h-4 w-4" />
              {t('sec.upload_history', 'আপলোড হিস্ট্রি', 'Upload history')}
            </Link>
            <button
              onClick={() => {
                setIsCreateOpen(true);
                setErrorMessage(null);
              }}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('sec.add', 'সেকশন যোগ করুন', 'Add section')}
            </button>
          </>
        }
      />

      {/* Notifications */}
      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('sec.total', 'মোট সেকশন', 'Sections')} value={sections.length} icon={<Layers className="h-4 w-4" />} tone="gray" />
        <StatCard
          label={t('sec.active', 'সক্রিয় সেকশন', 'Active sections')}
          value={sections.filter((s) => s.is_active).length}
          icon={<CheckCircle className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label={t('sec.total_links', 'মোট লিংক', 'Total links')}
          value={sections.reduce((acc, s) => acc + s.total_links, 0)}
          icon={<LinkIcon className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label={t('sec.active_links', 'সক্রিয় লিংক', 'Active links')}
          value={sections.reduce((acc, s) => acc + s.active_links, 0)}
          icon={<LinkIcon className="h-4 w-4" />}
          tone="violet"
        />
      </div>

      {/* Sections Table */}
      <div className="card">
        <div className="card-header">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label={t('common.search', 'অনুসন্ধান', 'Search')}
              placeholder={t('sec.search_ph', 'নাম বা বিবরণ দিয়ে খুঁজুন...', 'Search name or description...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <span className="card-subtitle">
            {filteredSections.length} / {sections.length}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading', 'লোড হচ্ছে...', 'Loading...')}
          </div>
        ) : filteredSections.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title={t('sec.empty', 'কোনো সেকশন পাওয়া যায়নি', 'No sections found')}
            description={
              searchQuery
                ? t('sec.empty_search', 'অনুসন্ধানের সাথে কিছু মেলেনি', 'Nothing matches your search')
                : t('sec.empty_hint', 'শুরু করতে একটি সেকশন যোগ করুন', 'Add a section to get started')
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{t('sec.col_name', 'সেকশন', 'Section')}</th>
                  <th>{t('sec.col_desc', 'বিবরণ', 'Description')}</th>
                  <th className="text-right">{t('sec.col_links', 'লিংক (সক্রিয়/মোট)', 'Links (active/total)')}</th>
                  <th className="text-right">{t('sec.col_team', 'কর্মী', 'Team')}</th>
                  <th>{t('sec.col_status', 'স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right">
                    <span className="sr-only">{t('sec.col_actions', 'কার্যক্রম', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSections.map((sec) => (
                  <tr key={sec.id}>
                    <td className="font-medium text-slate-900">
                      <Link href={`/admin/sections/${sec.id}`} className="hover:text-brand-700 hover:underline">
                        {sec.name}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate text-slate-500">{sec.description || '—'}</td>
                    <td className="text-right tabular-nums">
                      <span className="font-medium text-slate-900">{sec.active_links}</span>
                      <span className="text-slate-400"> / {sec.total_links}</span>
                    </td>
                    <td className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {sec.assigned_employees}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sec)}
                        disabled={togglingId === sec.id}
                        title={sec.is_active ? t('sec.click_deactivate', 'নিষ্ক্রিয় করতে ক্লিক করুন', 'Click to deactivate') : t('sec.click_activate', 'সক্রিয় করতে ক্লিক করুন', 'Click to activate')}
                        className="cursor-pointer disabled:opacity-50"
                      >
                        <span className={`badge ${sec.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {togglingId === sec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          {sec.is_active ? t('sec.active_s', 'সক্রিয়', 'Active') : t('sec.inactive_s', 'নিষ্ক্রিয়', 'Inactive')}
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-0.5">
                        {/* Upload CSV */}
                        <Link
                          href={`/admin/sections/${sec.id}/upload`}
                          className="btn-icon"
                          title={t('sec.upload_csv', 'CSV আপলোড', 'Upload CSV')}
                          aria-label={t('sec.upload_csv', 'CSV আপলোড', 'Upload CSV')}
                        >
                          <Upload className="h-4 w-4" />
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
                          className="btn-icon"
                          title={t('common.edit', 'সম্পাদনা', 'Edit')}
                          aria-label={t('common.edit', 'সম্পাদনা', 'Edit')}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* Delete or Deactivate */}
                        <button
                          onClick={() => {
                            setDeleteSection(sec);
                            setDeleteError(null);
                          }}
                          className="btn-icon hover:bg-rose-50 hover:text-rose-600"
                          title={sec.total_links > 0 ? t('sec.deactivate', 'নিষ্ক্রিয় করুন', 'Deactivate') : t('common.delete', 'মুছুন', 'Delete')}
                          aria-label={sec.total_links > 0 ? t('sec.deactivate', 'নিষ্ক্রিয় করুন', 'Deactivate') : t('common.delete', 'মুছুন', 'Delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-sec-title">
            <div className="card-header">
              <h3 id="create-sec-title" className="card-title">{t('sec.new', 'নতুন সেকশন', 'New section')}</h3>
            </div>

            <form onSubmit={handleCreate}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="create_sec_name" className="label">{t('sec.f_name', 'নাম', 'Name')} *</label>
                  <input
                    id="create_sec_name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Agro Groups, Restaurant Groups"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="create_sec_desc" className="label">{t('sec.f_desc', 'বিবরণ', 'Description')}</label>
                  <textarea
                    id="create_sec_desc"
                    rows={3}
                    maxLength={500}
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    className="input"
                  />
                </div>

                <label htmlFor="create_is_active" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    id="create_is_active"
                    checked={createActive}
                    onChange={(e) => setCreateActive(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-brand-600"
                  />
                  {t('sec.f_active', 'সক্রিয়', 'Active')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={createSubmitting} className="btn btn-primary">
                  {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('sec.create', 'তৈরি করুন', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Section */}
      {editingSection && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-sec-title">
            <div className="card-header">
              <h3 id="edit-sec-title" className="card-title">{t('sec.edit_title', 'সেকশন সম্পাদনা', 'Edit section')}</h3>
            </div>

            <form onSubmit={handleEdit}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="edit_sec_name" className="label">{t('sec.f_name', 'নাম', 'Name')} *</label>
                  <input
                    id="edit_sec_name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="edit_sec_desc" className="label">{t('sec.f_desc', 'বিবরণ', 'Description')}</label>
                  <textarea
                    id="edit_sec_desc"
                    rows={3}
                    maxLength={500}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="input"
                  />
                </div>

                <label htmlFor="edit_is_active" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  {t('sec.f_active', 'সক্রিয়', 'Active')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingSection(null)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} className="btn btn-primary">
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('common.save', 'সংরক্ষণ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete / Deactivate */}
      {deleteSection && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-sec-title">
            <div className="card-header">
              <h3 id="delete-sec-title" className="card-title">
                {deleteSection.total_links > 0
                  ? t('sec.deactivate_title', 'সেকশন নিষ্ক্রিয় করুন', 'Deactivate section')
                  : t('sec.delete_title', 'সেকশন মুছুন', 'Delete section')}
              </h3>
            </div>

            <div className="card-body space-y-3">
              {deleteError && <div className="alert alert-error">{deleteError}</div>}

              {deleteSection.total_links > 0 ? (
                <>
                  <div className="alert alert-warning">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {deleteSection.active_links > 0
                        ? t(
                            'sec.has_active_links',
                            `এই সেকশনে ${deleteSection.active_links}টি সক্রিয় লিংক (মোট ${deleteSection.total_links}টি) আছে, তাই মোছা যাবে না।`,
                            `This section has ${deleteSection.active_links} active links (${deleteSection.total_links} total), so it can't be deleted.`
                          )
                        : t(
                            'sec.has_links',
                            `এই সেকশনে ${deleteSection.total_links}টি লিংক আছে, তাই মোছা যাবে না।`,
                            `This section has ${deleteSection.total_links} links, so it can't be deleted.`
                          )}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {t(
                      'sec.deactivate_desc',
                      'নিষ্ক্রিয় করলে লিংকগুলো কর্মীদের কিউ থেকে সরবে, তবে কাজের ইতিহাস থাকবে।',
                      'Deactivating removes the links from task queues; completed work history is kept.'
                    )}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  {t(
                    'sec.delete_confirm',
                    `"${deleteSection.name}" সেকশনটি মুছে ফেলবেন? এতে কোনো লিংক নেই।`,
                    `Delete "${deleteSection.name}"? It has no links.`
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setDeleteSection(null)} className="btn btn-secondary">
                {t('common.cancel', 'বাতিল', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteOrDeactivate}
                disabled={deleteSubmitting}
                className={deleteSection.total_links > 0 ? 'btn btn-primary' : 'btn btn-danger'}
              >
                {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {deleteSection.total_links > 0 ? t('sec.deactivate', 'নিষ্ক্রিয় করুন', 'Deactivate') : t('common.delete', 'মুছুন', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
