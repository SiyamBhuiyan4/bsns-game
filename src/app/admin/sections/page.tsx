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
  UserPlus,
  CheckSquare,
  Square,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';
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
  const { t, L } = useLanguage();
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

  // Assign Employees Modal
  const [assigningSection, setAssigningSection] = useState<Section | null>(null);
  const [assignEmployeesList, setAssignEmployeesList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [assignedEmpIds, setAssignedEmpIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
      } else {
        setErrorMessage(data.error || L('সেকশন তালিকা লোড করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।'));
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
      setErrorMessage(L('সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)'));
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
        setSuccessMessage(L('নতুন সেকশন সফলভাবে তৈরি হয়েছে (Section created successfully)'));
        setIsCreateOpen(false);
        setCreateName('');
        setCreateDesc('');
        setCreateActive(true);
        fetchSections();
      } else {
        setErrorMessage(data.error || L('সেকশন তৈরি ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    if (editName.trim().length < 2) {
      setErrorMessage(L('সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)'));
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
        setSuccessMessage(L('সেকশন তথ্য সফলভাবে আপডেট হয়েছে (Section updated)'));
        setEditingSection(null);
        fetchSections();
      } else {
        setErrorMessage(data.error || L('আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
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
        setSuccessMessage(L(`সেকশন "${sec.name}" ${!sec.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'} করা হয়েছে`));
        fetchSections();
      } else {
        setErrorMessage(data.error || L('স্ট্যাটাস আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
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
          setSuccessMessage(L('সেকশনটি সফলভাবে নিষ্ক্রিয় করা হয়েছে (Deactivated)'));
          setDeleteSection(null);
          fetchSections();
        } else {
          setDeleteError(data.error || L('নিষ্ক্রিয়করণ ব্যর্থ হয়েছে'));
        }
      } catch {
        setDeleteError(L('নেটওয়ার্ক ত্রুটি'));
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
        setSuccessMessage(L('সেকশনটি সফলভাবে মুছে ফেলা হয়েছে (Deleted)'));
        setDeleteSection(null);
        fetchSections();
      } else {
        setDeleteError(data.error || L('ডিলিট ব্যর্থ হয়েছে'));
      }
    } catch {
      setDeleteError(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleOpenAssign = async (sec: Section) => {
    setAssigningSection(sec);
    setAssignLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/sections/${sec.id}/assign`);
      const data = await res.json();
      if (res.ok) {
        setAssignEmployeesList(data.employees || []);
        setAssignedEmpIds(data.assignedEmployeeIds || []);
      }
    } catch {
      setErrorMessage(L('কর্মী তালিকা লোড করা যায়নি'));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSection) return;
    setAssignSubmitting(true);
    try {
      const res = await fetch(`/api/admin/sections/${assigningSection.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: assignedEmpIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('কর্মী সফলভাবে এসাইন করা হয়েছে (Employees assigned successfully)'));
        setAssigningSection(null);
        fetchSections();
      } else {
        setErrorMessage(data.error || L('অ্যাসাইনমেন্ট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setAssignSubmitting(false);
    }
  };

  const toggleEmployeeSelection = (empId: string) => {
    setAssignedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
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
          <span className="flex-1">{L(errorMessage)}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{L(successMessage)}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      {loading ? (
        <SkeletonStatCards count={4} label={t('common.loading', 'লোড হচ্ছে...', 'Loading...')} />
      ) : (
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      )}

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
          <SkeletonTable rows={6} cols={5} label={t('common.loading', 'লোড হচ্ছে...', 'Loading...')} />
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
                  <th className="text-right">{t('sec.col_team', 'কর্মী', 'Employees')}</th>
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
                      <button
                        type="button"
                        onClick={() => handleOpenAssign(sec)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                        title={t('sec.assign_employees', 'কর্মী এসাইন করুন', 'Assign employees')}
                      >
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-bold">{sec.assigned_employees}</span>
                      </button>
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
                        {/* Assign Employees */}
                        <button
                          type="button"
                          onClick={() => handleOpenAssign(sec)}
                          className="btn-icon text-brand-700 hover:bg-brand-50"
                          title={t('sec.assign_employees', 'কর্মী এসাইন করুন', 'Assign employees')}
                          aria-label={t('sec.assign_employees', 'কর্মী এসাইন করুন', 'Assign employees')}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>

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

      {/* Assign Employees Modal */}
      {assigningSection && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  {t('sec.assign_title', 'গ্রুপে কর্মী এসাইন করুন', 'Assign Employees to Group')}
                </h3>
                <p className="card-subtitle">{assigningSection.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningSection(null)}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssign} className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                {t(
                  'sec.assign_desc',
                  'যে যে কর্মী এই গ্রুপের লিংকে কাজ করবে তাদের সিলেক্ট করুন:',
                  'Select the employees who should receive and work on links from this group:'
                )}
              </p>

              {assignLoading ? (
                <div role="status" aria-busy="true" className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <span className="sr-only">{L("লোড হচ্ছে...")}</span>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between gap-2.5 p-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div aria-hidden className="skeleton h-7 w-7 rounded-full" />
                        <div className="space-y-1.5">
                          <div aria-hidden className="skeleton h-3.5 w-28" />
                          <div aria-hidden className="skeleton h-2.5 w-36" />
                        </div>
                      </div>
                      <div aria-hidden className="skeleton h-4 w-4 rounded" />
                    </div>
                  ))}
                </div>
              ) : assignEmployeesList.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                  {L("কোনো সক্রিয় কর্মী পাওয়া যায়নি। প্রথমে কর্মী যোগ করুন।")}
                </div>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 p-2">
                  {assignEmployeesList.map((emp) => {
                    const isSelected = assignedEmpIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                            {emp.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{emp.name}</div>
                            <div className="text-xs text-slate-400">{emp.email}</div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEmployeeSelection(emp.id)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setAssigningSection(null)}
                  className="btn btn-secondary"
                >
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting || assignLoading}
                  className="btn btn-primary"
                >
                  {assignSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('common.save', 'সংরক্ষণ করুন', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
