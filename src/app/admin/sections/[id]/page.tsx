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
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
  Users,
  UserCheck,
  FileSpreadsheet,
  PowerOff,
} from 'lucide-react';

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
        setErrorMessage(data.error || 'লিংক লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
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
        setSuccessMessage('নতুন গ্রুপ লিঙ্ক সফলভাবে যুক্ত হয়েছে');
        setIsAddOpen(false);
        setAddUrl('');
        setAddTitle('');
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || 'লিঙ্ক যোগ করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
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
        setSuccessMessage('লিংক আপডেট সফল হয়েছে');
        setEditingLink(null);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`আপনি কি নির্বাচিত ${selectedIds.length}টি লিঙ্ক নিষ্ক্রিয় করতে চান?`)) return;

    setBulkLoading(true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links/bulk-deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkIds: selectedIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'নির্বাচিত লিঙ্কসমূহ নিষ্ক্রিয় করা হয়েছে');
        setSelectedIds([]);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || 'বাল্ক নিষ্ক্রিয়করণ ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeactivateAll = async () => {
    if (!confirm('আপনি কি এই সেকশনের সকল সক্রিয় লিঙ্ক নিষ্ক্রিয় করতে চান? (Are you sure you want to deactivate all active links in this section?)')) return;

    setBulkLoading(true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/links/bulk-deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(data.message || 'সকল সক্রিয় লিঙ্ক নিষ্ক্রিয় করা হয়েছে');
        setSelectedIds([]);
        fetchLinks();
        fetchSectionInfo();
      } else {
        setErrorMessage(data.error || 'বাল্ক নিষ্ক্রিয়করণ ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
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

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href="/admin/sections" className="hover:text-emerald-700 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            সেকশন তালিকা
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">{section?.name || 'সেকশন বিবরণ'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Layers className="h-6 w-6 text-emerald-600" />
                {section?.name || 'সেকশন লিঙ্ক ব্যবস্থাপনা'}
              </h1>
              {section && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    section.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      section.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {section.is_active ? 'সক্রিয় সেকশন' : 'নিষ্ক্রিয় সেকশন'}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {section?.description || 'এই সেকশনের অধীনে থাকা সকল ফেসবুক ও সামাজিক গ্রুপ লিঙ্ক পরিচালনা করুন।'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/admin/sections/${sectionId}/upload`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              CSV আপলোড (Upload CSV)
            </Link>

            <button
              onClick={() => {
                setIsAddOpen(true);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              একক লিঙ্ক যোগ করুন (Add Link)
            </button>
          </div>
        </div>
      </div>

      {/* Section Overview Cards: Link Count, Employee Assignments, Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Links Stats */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>লিঙ্ক পরিসংখ্যান (Links)</span>
            <Layers className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {section?._count?.group_links ?? totalLinks}
            </span>
            <span className="text-xs text-slate-500">মোট লিঙ্ক</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {section?.active_links_count ?? links.filter((l) => l.is_active).length} সক্রিয়
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 border border-slate-200/50">
              {(section?._count?.group_links ?? totalLinks) - (section?.active_links_count ?? 0)} নিষ্ক্রিয়
            </span>
          </div>
        </div>

        {/* Card 2: Assigned Employees */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>নির্ধারিত মার্কেটার (Assigned Marketers)</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {section?.assignments?.length ?? section?._count?.assignments ?? 0}
            </span>
            <span className="text-xs text-slate-500">জন কর্মী</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
            {section?.assignments && section.assignments.length > 0 ? (
              section.assignments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-xs font-medium text-blue-700"
                  title={a.employee.email}
                >
                  <UserCheck className="h-3 w-3 text-blue-600" />
                  {a.employee.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> কোনো কর্মী নির্ধারিত নেই
                <Link href="/admin/employees" className="underline font-semibold ml-1 hover:text-amber-800">
                  কর্মী যুক্ত করুন
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Batch Uploads & Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>CSV আপলোড ও বাল্ক নিয়ন্ত্রণ</span>
            <FileSpreadsheet className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {section?._count?.csv_batches ?? 0}
            </span>
            <span className="text-xs text-slate-500">টি CSV ব্যাচ</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {(section?.active_links_count ?? 0) > 0 && (
              <button
                onClick={handleBulkDeactivateAll}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                title="এই সেকশনের সকল সক্রিয় লিঙ্ক এক ক্লিকে নিষ্ক্রিয় করুন"
              >
                <PowerOff className="h-3 w-3 text-amber-600" />
                সব নিষ্ক্রিয় করুন
              </button>
            )}
          </div>
        </div>
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

      {/* Filter and Bulk Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="লিঙ্ক বা শিরোনাম দিয়ে অনুসন্ধান..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 py-1.5 px-3 text-xs text-slate-700 bg-white focus:border-emerald-600 focus:outline-none cursor-pointer"
          >
            <option value="ALL">সব স্ট্যাটাস (All)</option>
            <option value="ACTIVE">শুধুমাত্র সক্রিয় (Active)</option>
            <option value="INACTIVE">নিষ্ক্রিয় (Inactive)</option>
          </select>
        </div>

        {/* Bulk Action Button */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <span className="text-xs font-semibold text-slate-600">
              {selectedIds.length}টি নির্বাচিত
            </span>
            <button
              onClick={handleBulkDeactivate}
              disabled={bulkLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer"
            >
              {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              বাল্ক নিষ্ক্রিয় করুন (Deactivate Selected)
            </button>
          </div>
        )}
      </div>

      {/* Links Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">লিংক তালিকা লোড হচ্ছে...</p>
          </div>
        ) : links.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Layers className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো গ্রুপ লিঙ্ক পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'অনুসন্ধানের সাথে কোনো লিঙ্ক মেলেনি' : 'উপরে CSV আপলোড বা একক লিঙ্ক যোগ করুন'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      title="সব নির্বাচন করুন"
                    >
                      {selectedIds.length === links.length ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">গ্রুপ শিরোনাম ও লিঙ্ক (Title & URL)</th>
                  <th className="py-3 px-4 text-center">সম্পন্ন সংখ্যা (Done)</th>
                  <th className="py-3 px-4">আপলোড ব্যাচ (Batch)</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস (Status)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {links.map((link) => {
                  const isSelected = selectedIds.includes(link.id);
                  return (
                    <tr
                      key={link.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSelected ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleSelectOne(link.id)}
                          className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 max-w-md">
                        <div className="font-semibold text-slate-900 truncate">
                          {link.title || 'শিরোনাম নেই (Untitled)'}
                        </div>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700 hover:underline truncate max-w-full"
                          title={link.url}
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                          {link.completions_count} বার
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-500">
                        {link.batch_file ? (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {link.batch_file}
                          </span>
                        ) : (
                          'ম্যানুয়াল এন্ট্রি'
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {link.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3 text-emerald-600" /> সক্রিয়
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                            <XCircle className="h-3 w-3 text-slate-400" /> নিষ্ক্রিয়
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setEditUrl(link.url);
                            setEditTitle(link.title || '');
                            setEditActive(link.is_active);
                            setErrorMessage(null);
                          }}
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-6">
            <div className="text-xs text-slate-500">
              মোট <strong>{totalLinks}</strong> টির মধ্যে{' '}
              <strong>{(page - 1) * 25 + 1}</strong> থেকে{' '}
              <strong>{Math.min(page * 25, totalLinks)}</strong> দেখানো হচ্ছে
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                আগের পাতা (Prev)
              </button>
              <span className="px-2 text-xs font-medium text-slate-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                পরের পাতা (Next)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Link */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন গ্রুপ লিঙ্ক যোগ করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Add single Facebook or social group URL</p>

            <form onSubmit={handleAddLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  গ্রুপ URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.facebook.com/groups/..."
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  গ্রুপের নাম / শিরোনাম (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: Agro Farmers BD"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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

      {/* Modal: Edit Link */}
      {editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">গ্রুপ লিঙ্ক সম্পাদনা করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Edit Group Link Details</p>

            <form onSubmit={handleEditLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  গ্রুপ URL *
                </label>
                <input
                  type="url"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  গ্রুপ শিরোনাম
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit_link_active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_link_active" className="text-xs font-semibold text-slate-700">
                  লিঙ্কটি সক্রিয় রাখুন (Keep Active in Marketer Queue)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
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
                  আপডেট করুন (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
