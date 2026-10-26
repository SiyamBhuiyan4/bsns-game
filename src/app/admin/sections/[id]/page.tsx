'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Upload,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  CheckCircle,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  Users,
  FileSpreadsheet,
  PowerOff,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

interface GroupLinkItem {
  id: string;
  url: string;
  title: string | null;
  is_active: boolean;
  created_at: string;
  batch_file: string | null;
  completions_count: number;
}

interface AssignedEmployee {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
}

interface SectionInfo {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  active_links_count?: number;
  assignments?: AssignedEmployee[];
  _count?: {
    group_links: number;
    assignments: number;
    csv_batches: number;
  };
}

export default function SectionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sectionId } = use(params);
  const { t, L } = useLanguage();

  const [section, setSection] = useState<SectionInfo | null>(null);
  const [links, setLinks] = useState<GroupLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLinks, setTotalLinks] = useState(0);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Link Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit Link Modal
  const [editingLink, setEditingLink] = useState<GroupLinkItem | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchSectionInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}`);
      const data = await res.json();
      if (res.ok) {
        setSection(data.section);
      }
    } catch (err) {
      console.error(err);
    }
  }, [sectionId]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/sections/${sectionId}/links?q=${encodeURIComponent(
        searchQuery
      )}&status=${statusFilter}&page=${page}&limit=25`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setLinks(data.links || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalLinks(data.pagination?.total || 0);
        setSelectedIds([]);
      } else {
        setErrorMessage(data.error || L('লিংক লোড করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setLoading(false);
    }
  }, [sectionId, searchQuery, statusFilter, page]);

  useEffect(() => {
    fetchSectionInfo();
  }, [fetchSectionInfo]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl, title: addTitle }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('নতুন গ্রুপ লিঙ্ক সফলভাবে যুক্ত হয়েছে'));
        setIsAddOpen(false);
        setAddUrl('');
        setAddTitle('');
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || L('লিঙ্ক যোগ করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;
    setEditSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links/${editingLink.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: editUrl,
          title: editTitle,
          is_active: editActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('লিংক আপডেট সফল হয়েছে'));
        setEditingLink(null);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || L('আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(L(`আপনি কি নির্বাচিত ${selectedIds.length}টি লিঙ্ক নিষ্ক্রিয় করতে চান?`))) return;

    setBulkLoading(true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links/bulk-deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkIds: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || L('নির্বাচিত লিঙ্কসমূহ নিষ্ক্রিয় করা হয়েছে'));
        setSelectedIds([]);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || L('বাল্ক নিষ্ক্রিয়করণ ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeactivateAll = async () => {
    if (!confirm(L('আপনি কি এই সেকশনের সকল সক্রিয় লিঙ্ক নিষ্ক্রিয় করতে চান? (Are you sure you want to deactivate all active links in this section?)'))) return;

    setBulkLoading(true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links/bulk-deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || L('সকল সক্রিয় লিঙ্ক নিষ্ক্রিয় করা হয়েছে'));
        setSelectedIds([]);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || L('বাল্ক নিষ্ক্রিয়করণ ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === links.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(links.map((l) => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };


  const totalCount = section?._count?.group_links ?? totalLinks;
  const assignedCount = section?.assignments?.length ?? section?._count?.assignments ?? 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link href="/admin/sections" className="-mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('sec.back', 'সব সেকশন', 'All sections')}
      </Link>

      <PageHeader
        icon={<Layers className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {section?.name || t('sec.detail', 'সেকশন', 'Section')}
            {section && (
              <span className={`badge ${section.is_active ? 'badge-green' : 'badge-gray'}`}>
                {section.is_active ? t('sec.active_s', 'সক্রিয়', 'Active') : t('sec.inactive_s', 'নিষ্ক্রিয়', 'Inactive')}
              </span>
            )}
          </span>
        }
        subtitle={section?.description || t('sec.detail_sub', 'এই সেকশনের গ্রুপ লিংক পরিচালনা করুন', 'Manage group links in this section')}
        actions={
          <>
            <Link href={`/admin/sections/${sectionId}/upload`} className="btn btn-secondary">
              <Upload className="h-4 w-4" />
              {t('sec.upload_csv', 'CSV আপলোড', 'Upload CSV')}
            </Link>
            <button
              onClick={() => {
                setIsAddOpen(true);
                setErrorMessage(null);
              }}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('sec.add_link', 'লিংক যোগ করুন', 'Add link')}
            </button>
          </>
        }
      />

      {/* Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={t('sec.total_links', 'মোট লিংক', 'Total links')}
          value={totalCount}
          icon={<Layers className="h-4 w-4" />}
          note={
            <span className="flex flex-wrap gap-1.5">
              <span className="badge badge-green">
                {section?.active_links_count ?? links.filter((l) => l.is_active).length} {t('sec.active_s', 'সক্রিয়', 'Active')}
              </span>
              <span className="badge badge-gray">
                {(section?._count?.group_links ?? totalLinks) - (section?.active_links_count ?? 0)} {t('sec.inactive_s', 'নিষ্ক্রিয়', 'Inactive')}
              </span>
            </span>
          }
        />

        <StatCard
          label={t('sec.assigned', 'নির্ধারিত কর্মী', 'Assigned employees')}
          value={assignedCount}
          icon={<Users className="h-4 w-4" />}
          tone="blue"
          note={
            <span className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto">
              {section?.assignments && section.assignments.length > 0 ? (
                section.assignments.map((a) => (
                  <span key={a.id} className="badge badge-blue" title={a.employee.email}>
                    {a.employee.name}
                  </span>
                ))
              ) : (
                <span>
                  {t('sec.no_team', 'কেউ নির্ধারিত নেই।', 'No one assigned.')}{' '}
                  <Link href="/admin/employees" className="font-medium text-brand-700 hover:underline">
                    {t('sec.assign_team', 'কর্মী যুক্ত করুন', 'Assign employees')}
                  </Link>
                </span>
              )}
            </span>
          }
        />

        <StatCard
          label={t('sec.csv_batches', 'CSV ব্যাচ', 'CSV batches')}
          value={section?._count?.csv_batches ?? 0}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          tone="violet"
          note={
            (section?.active_links_count ?? 0) > 0 ? (
              <button
                onClick={handleBulkDeactivateAll}
                disabled={bulkLoading}
                className="btn btn-secondary btn-sm"
                title={t('sec.deactivate_all_tip', 'এই সেকশনের সব সক্রিয় লিংক নিষ্ক্রিয় করুন', 'Deactivate every active link in this section')}
              >
                <PowerOff className="h-3.5 w-3.5" />
                {t('sec.deactivate_all', 'সব নিষ্ক্রিয় করুন', 'Deactivate all')}
              </button>
            ) : undefined
          }
        />
      </div>

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

      {/* Links Table */}
      <div className="card">
        <div className="card-header">
          <div className="flex w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label={t('common.search', 'অনুসন্ধান', 'Search')}
                placeholder={t('sec.link_search_ph', 'লিংক বা শিরোনাম খুঁজুন...', 'Search URL or title...')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="input pl-9"
              />
            </div>

            <select
              aria-label={t('sec.col_status', 'স্ট্যাটাস', 'Status')}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
                setPage(1);
              }}
              className="input w-full sm:w-40"
            >
              <option value="ALL">{t('sec.f_all', 'সব স্ট্যাটাস', 'All statuses')}</option>
              <option value="ACTIVE">{t('sec.active_s', 'সক্রিয়', 'Active')}</option>
              <option value="INACTIVE">{t('sec.inactive_s', 'নিষ্ক্রিয়', 'Inactive')}</option>
            </select>
          </div>

          {/* Bulk Action Button */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                {t('sec.selected', `${selectedIds.length}টি নির্বাচিত`, `${selectedIds.length} selected`)}
              </span>
              <button onClick={handleBulkDeactivate} disabled={bulkLoading} className="btn btn-secondary btn-sm">
                {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PowerOff className="h-3.5 w-3.5" />}
                {t('sec.deactivate', 'নিষ্ক্রিয় করুন', 'Deactivate')}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading', 'লোড হচ্ছে...', 'Loading...')}
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title={t('sec.no_links', 'কোনো লিংক পাওয়া যায়নি', 'No links found')}
            description={
              searchQuery
                ? t('sec.empty_search', 'অনুসন্ধানের সাথে কিছু মেলেনি', 'Nothing matches your search')
                : t('sec.no_links_hint', 'CSV আপলোড করুন বা একটি লিংক যোগ করুন', 'Upload a CSV or add a link')
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="flex cursor-pointer items-center text-slate-400 hover:text-slate-600"
                      title={t('sec.select_all', 'সব নির্বাচন', 'Select all')}
                      aria-label={t('sec.select_all', 'সব নির্বাচন', 'Select all')}
                    >
                      {selectedIds.length === links.length ? (
                        <CheckSquare className="h-4 w-4 text-brand-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th>{t('sec.col_link', 'গ্রুপ', 'Group')}</th>
                  <th className="text-right">{t('sec.col_done', 'সম্পন্ন', 'Done')}</th>
                  <th>{t('sec.col_batch', 'ব্যাচ', 'Batch')}</th>
                  <th>{t('sec.col_status', 'স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right">
                    <span className="sr-only">{t('sec.col_actions', 'কার্যক্রম', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const isSelected = selectedIds.includes(link.id);
                  return (
                    <tr key={link.id} className={isSelected ? '[&>td]:bg-brand-50/40' : ''}>
                      <td>
                        <button
                          onClick={() => toggleSelectOne(link.id)}
                          className="flex cursor-pointer items-center text-slate-400 hover:text-slate-600"
                          aria-label={t('sec.select', 'নির্বাচন', 'Select')}
                        >
                          {isSelected ? <CheckSquare className="h-4 w-4 text-brand-600" /> : <Square className="h-4 w-4" />}
                        </button>
                      </td>

                      <td className="max-w-md">
                        <div className="truncate font-medium text-slate-900">
                          {link.title || t('sec.untitled', 'শিরোনাম নেই', 'Untitled')}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-xs text-slate-500 hover:text-brand-700 hover:underline"
                          title={link.url}
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>

                      <td className="text-right tabular-nums font-medium text-slate-900">{link.completions_count}</td>

                      <td className="text-xs text-slate-500">
                        {link.batch_file ? (
                          <span className="font-mono text-[11px]">{link.batch_file}</span>
                        ) : (
                          t('sec.manual', 'ম্যানুয়াল', 'Manual')
                        )}
                      </td>

                      <td>
                        {link.is_active ? (
                          <span className="badge badge-green">{t('sec.active_s', 'সক্রিয়', 'Active')}</span>
                        ) : (
                          <span className="badge badge-gray">{t('sec.inactive_s', 'নিষ্ক্রিয়', 'Inactive')}</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setEditUrl(link.url);
                            setEditTitle(link.title || '');
                            setEditActive(link.is_active);
                            setErrorMessage(null);
                          }}
                          className="btn-icon"
                          title={t('common.edit', 'সম্পাদনা', 'Edit')}
                          aria-label={t('common.edit', 'সম্পাদনা', 'Edit')}
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

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <div className="text-xs text-slate-500 tabular-nums">
              {(page - 1) * 25 + 1}–{Math.min(page * 25, totalLinks)} / {totalLinks}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                {t('common.prev', 'আগের', 'Prev')}
              </button>
              <span className="px-2 text-xs font-medium text-slate-600 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary btn-sm"
              >
                {t('common.next', 'পরের', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Link */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-link-title">
            <div className="card-header">
              <h3 id="add-link-title" className="card-title">{t('sec.add_link', 'লিংক যোগ করুন', 'Add link')}</h3>
            </div>

            <form onSubmit={handleAddLink}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="add_link_url" className="label">{t('sec.f_url', 'গ্রুপ URL', 'Group URL')} *</label>
                  <input
                    id="add_link_url"
                    type="url"
                    required
                    placeholder="https://www.facebook.com/groups/..."
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="add_link_title" className="label">{t('sec.f_title', 'শিরোনাম', 'Title')}</label>
                  <input
                    id="add_link_title"
                    type="text"
                    placeholder="Agro Farmers BD"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    className="input"
                  />
                  <p className="hint">{t('common.optional', 'ঐচ্ছিক', 'Optional')}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={addSubmitting} className="btn btn-primary">
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('common.add', 'যোগ করুন', 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Link */}
      {editingLink && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-link-title">
            <div className="card-header">
              <h3 id="edit-link-title" className="card-title">{t('sec.edit_link', 'লিংক সম্পাদনা', 'Edit link')}</h3>
            </div>

            <form onSubmit={handleEditLink}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="edit_link_url" className="label">{t('sec.f_url', 'গ্রুপ URL', 'Group URL')} *</label>
                  <input
                    id="edit_link_url"
                    type="url"
                    required
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="edit_link_title" className="label">{t('sec.f_title', 'শিরোনাম', 'Title')}</label>
                  <input
                    id="edit_link_title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="input"
                  />
                </div>

                <label htmlFor="edit_link_active" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    id="edit_link_active"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  {t('sec.link_active', 'সক্রিয় (কর্মীদের কিউতে থাকবে)', 'Active (shown in employee queue)')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingLink(null)} className="btn btn-secondary">
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
    </div>
  );
}
