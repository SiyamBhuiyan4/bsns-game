'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { History, FileSpreadsheet, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';
import { format } from 'date-fns';
import { SkeletonTable } from '@/components/ui/Skeleton';

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
  const { t } = useLanguage();
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
      <Link href="/admin/sections" className="-mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('sec.back', 'সব সেকশন', 'All sections')}
      </Link>

      <PageHeader
        icon={<History className="h-5 w-5" />}
        title={t('hist.title', 'আপলোড হিস্ট্রি', 'Upload history')}
        subtitle={t('hist.subtitle', 'সব CSV ব্যাচ, ফলাফল ও আপলোডকারী', 'Every CSV batch, its results and who uploaded it')}
      />

      {/* History Table */}
      <div className="card">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title">{t('hist.batches', 'সব ব্যাচ', 'All batches')}</h2>
            <p className="card-subtitle tabular-nums">{t('hist.count', 'মোট', 'Total')}: {pagination.total}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label htmlFor="hist_section" className="whitespace-nowrap text-xs font-medium text-slate-600">
              {t('hist.section', 'সেকশন', 'Section')}
            </label>
            <select
              id="hist_section"
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setPage(1);
              }}
              className="input sm:w-56"
            >
              <option value="">{t('hist.all_sections', 'সব সেকশন', 'All sections')}</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={5} label={t('common.loading', 'লোড হচ্ছে...', 'Loading...')} />
        ) : batches.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title={t('hist.empty', 'কোনো আপলোড নেই', 'No uploads yet')}
            description={t('hist.empty_hint', 'সেকশন পেজ থেকে CSV আপলোড করলে এখানে দেখাবে।', 'CSV uploads from a section page will appear here.')}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-pro min-w-[800px]">
                <thead>
                  <tr>
                    <th>{t('hist.file', 'ফাইল', 'File')}</th>
                    <th>{t('hist.section', 'সেকশন', 'Section')}</th>
                    <th>{t('hist.by', 'আপলোডকারী', 'Uploaded by')}</th>
                    <th className="text-right">{t('hist.total', 'মোট', 'Total')}</th>
                    <th className="text-right">{t('hist.inserted', 'সংরক্ষিত', 'Inserted')}</th>
                    <th className="text-right">{t('hist.duplicates', 'ডুপ্লিকেট', 'Duplicates')}</th>
                    <th className="text-right">{t('hist.invalid', 'অবৈধ', 'Invalid')}</th>
                    <th className="text-right">{t('hist.date', 'তারিখ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="font-mono text-xs font-medium text-slate-900">{b.file_name}</span>
                        </div>
                      </td>

                      <td>
                        <Link href={`/admin/sections/${b.section_id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                          {b.section_name}
                        </Link>
                      </td>

                      <td>
                        <div className="font-medium text-slate-800">{b.uploader_name}</div>
                        <div className="text-xs text-slate-500">{b.uploader_email}</div>
                      </td>

                      <td className="text-right tabular-nums font-medium text-slate-900">{b.total_rows}</td>

                      <td className="text-right tabular-nums text-emerald-700">{b.inserted}</td>

                      <td className="text-right">
                        {b.duplicates > 0 ? (
                          <span className="badge badge-amber tabular-nums">{b.duplicates}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="text-right">
                        {b.invalid > 0 ? (
                          <span className="badge badge-red tabular-nums">{b.invalid}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap text-right text-xs text-slate-500 tabular-nums">
                        {format(new Date(b.created_at), 'dd MMM yyyy, hh:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-600 sm:flex-row">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular-nums">
                  {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} / {pagination.total}
                </span>
                <label className="flex items-center gap-1.5">
                  <span>{t('hist.per_page', 'প্রতি পৃষ্ঠায়', 'Per page')}</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="input input-sm w-auto"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="btn btn-secondary btn-sm"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {t('common.prev', 'আগের', 'Prev')}
                </button>
                <span className="px-2 font-medium tabular-nums text-slate-700">
                  {pagination.page} / {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages || loading}
                  className="btn btn-secondary btn-sm"
                >
                  {t('common.next', 'পরের', 'Next')}
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
