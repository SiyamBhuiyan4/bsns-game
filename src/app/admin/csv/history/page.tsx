'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  History,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Calendar,
  Layers,
  ArrowLeft,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface BatchItem {
  id: string;
  file_name: string;
  section_id: string;
  section_name: string;
  uploader_name: string;
  uploader_email: string;
  total_rows: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  created_at: string;
}

interface SectionOption {
  id: string;
  name: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function CsvUploadHistoryPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSection) {
        params.append('sectionId', selectedSection);
      }
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/admin/csv/history?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setBatches(data.batches || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, page, limit]);

  const fetchSections = async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href="/admin/sections" className="hover:text-emerald-700 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            গ্রুপ সেকশন তালিকা
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">CSV আপলোড ইতিহাস</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <History className="h-6 w-6 text-emerald-600" />
              CSV আপলোড হিস্ট্রি ও অডিট ট্র্যাকিং
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              গ্রুপ সেকশনে আপলোডকৃত সকল CSV ব্যাচের বিস্তারিত বিবরণ, ফলাফল ও আপলোডকারীর তথ্য।
            </p>
          </div>

          {/* Section Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              সেকশন ফিল্টার:
            </label>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none cursor-pointer"
            >
              <option value="">সকল সেকশন (All Sections)</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">আপলোড ইতিহাস লোড হচ্ছে...</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো আপলোড রেকর্ড পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              সেকশন পেজ থেকে CSV ফাইল আপলোড করলে এখানে সম্পূর্ণ ইতিহাস দেখতে পাবেন।
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 sm:px-6">ফাইলের নাম (File Name)</th>
                    <th className="py-3 px-4">লক্ষ্য সেকশন (Target Section)</th>
                    <th className="py-3 px-4">আপলোডকারী (Uploaded By)</th>
                    <th className="py-3 px-4 text-center">মোট সারি (Total)</th>
                    <th className="py-3 px-4 text-center">সংরক্ষিত (Inserted)</th>
                    <th className="py-3 px-4 text-center">ডুপ্লিকেট (Duplicates)</th>
                    <th className="py-3 px-4 text-center">অবৈধ (Invalid)</th>
                    <th className="py-3 px-4 sm:px-6 text-right">তারিখ ও সময় (Asia/Dhaka)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-mono text-xs">{b.file_name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Link
                          href={`/admin/sections/${b.section_id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          <Layers className="h-3 w-3" />
                          {b.section_name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-800">{b.uploader_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{b.uploader_email}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {b.total_rows}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          {b.inserted}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {b.duplicates > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                            {b.duplicates}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">০</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {b.invalid > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                            <XCircle className="h-3 w-3 text-rose-600" />
                            {b.invalid}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">০</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right text-xs text-slate-600 font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {format(new Date(b.created_at), 'dd MMM yyyy, hh:mm a')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/75 px-4 sm:px-6 py-3.5 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  মোট <strong>{pagination.total}</strong> টির মধ্যে{' '}
                  {pagination.total === 0
                    ? 0
                    : (pagination.page - 1) * pagination.limit + 1}{' '}
                  - {Math.min(pagination.page * pagination.limit, pagination.total)} টি দেখানো হচ্ছে
                </span>
                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1.5 font-medium">
                  <span>প্রতি পৃষ্ঠায়:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>১০</option>
                    <option value={20}>২০</option>
                    <option value={50}>৫০</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  পূর্ববর্তী
                </button>
                <span className="px-2.5 py-1 text-xs font-semibold text-slate-700">
                  পৃষ্ঠা {pagination.page} এর {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages || loading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  পরবর্তী
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
