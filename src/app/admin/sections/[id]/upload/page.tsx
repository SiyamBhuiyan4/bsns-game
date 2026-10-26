'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Layers,
  Info,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { useLanguage } from '@/components/LanguageContext';
import { exportInvalidRowsToCsv } from '@/lib/csv';

interface PreviewRow {
  rowNumber: number;
  url: string;
  title?: string;
  status: 'VALID' | 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_SECTION' | 'EXISTS_IN_OTHER_SECTION' | 'INVALID';
  reason?: string;
  warning?: string;
}

interface InvalidRow {
  rowNumber: number;
  url: string;
  title?: string;
  reason: string;
}

interface PreviewData {
  fileName: string;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  warningCount: number;
  previewRows: PreviewRow[];
  invalidRows: InvalidRow[];
  validRowsToInsert: Array<{ url: string; title?: string }>;
}

export default function SectionCsvUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sectionId } = use(params);
  const router = useRouter();
  const { t, L } = useLanguage();

  const [sectionName, setSectionName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    inserted: number;
    duplicates: number;
    invalid: number;
    batchId: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSection = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/sections/${sectionId}`);
      const data = await res.json();
      if (res.ok && data.section) {
        setSectionName(data.section.name);
      }
    } catch {
      // ignore
    }
  }, [sectionId]);

  useEffect(() => {
    fetchSection();
  }, [fetchSection]);

  const validateAndSetFile = (selected: File) => {
    if (!selected.name.toLowerCase().endsWith('.csv') && selected.type !== 'text/csv' && selected.type !== 'application/vnd.ms-excel') {
      setErrorMessage(t('up.onlyCsv', 'দয়া করে শুধুমাত্র .csv ফাইল আপলোড করুন', 'Only .csv files supported'));
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setErrorMessage(t('up.maxSize', 'ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট হতে পারবে', 'Max 5MB file size limit exceeded'));
      return;
    }
    setFile(selected);
    setErrorMessage(null);
    setPreviewData(null);
    setUploadResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleParsePreview = async () => {
    if (!file) return;
    setParsing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/csv/preview`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data);
      } else {
        setErrorMessage(data.error || L('ফাইল প্রিভিউ প্রক্রিয়া ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।'));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!previewData) return;
    setConfirming(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/sections/${sectionId}/csv/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: previewData.fileName,
          totalRows: previewData.totalRows,
          duplicateCount: previewData.duplicateCount,
          invalidCount: previewData.invalidCount,
          validRows: previewData.validRowsToInsert,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUploadResult({
          inserted: data.inserted,
          duplicates: data.duplicates,
          invalid: data.invalid,
          batchId: data.batchId,
        });
      } else {
        setErrorMessage(data.error || L('সংরক্ষণ ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setConfirming(false);
    }
  };

  const downloadInvalidCsv = () => {
    if (!previewData || previewData.invalidRows.length === 0) return;
    const csvString = exportInvalidRowsToCsv(previewData.invalidRows);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `invalid_rows_${previewData.fileName}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      <Link
        href={`/admin/sections/${sectionId}`}
        className="-mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {sectionName || t('sec.detail', 'সেকশন', 'Section')}
      </Link>

      <PageHeader
        icon={<Upload className="h-5 w-5" />}
        title={t('up.title', 'CSV আপলোড', 'Upload CSV')}
        subtitle={
          sectionName
            ? t('up.subtitle', `${sectionName} সেকশনে গ্রুপ লিংক আপলোড করুন · সর্বোচ্চ ৫ MB, ১০,০০০ সারি`, `Bulk-add group links to ${sectionName} · max 5 MB, 10,000 rows`)
            : t('up.subtitle_plain', 'সর্বোচ্চ ৫ MB, ১০,০০০ সারি', 'Max 5 MB, 10,000 rows')
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

      {/* Result Screen (After Confirm) */}
      {uploadResult ? (
        <div className="card">
          <div className="card-body flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{t('up.done', 'আপলোড সম্পন্ন', 'Upload complete')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('up.done_sub', 'লিংকগুলো সংরক্ষিত হয়েছে।', 'Links have been saved.')}</p>

            <div className="mt-6 grid w-full max-w-lg grid-cols-3 gap-4 text-left">
              <StatCard label={t('up.inserted', 'সংরক্ষিত', 'Inserted')} value={uploadResult.inserted} />
              <StatCard label={t('up.duplicates', 'ডুপ্লিকেট', 'Duplicates')} value={uploadResult.duplicates} />
              <StatCard label={t('up.invalid', 'অবৈধ', 'Invalid')} value={uploadResult.invalid} />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {uploadResult.invalid > 0 && previewData && previewData.invalidRows.length > 0 && (
                <button onClick={downloadInvalidCsv} className="btn btn-secondary">
                  <Download className="h-4 w-4" />
                  {t('up.download_invalid', 'অবৈধ সারি ডাউনলোড', 'Download invalid rows')}
                </button>
              )}

              <Link href="/admin/csv/history" className="btn btn-secondary">
                {t('sec.upload_history', 'আপলোড হিস্ট্রি', 'Upload history')}
              </Link>

              <button onClick={() => router.push(`/admin/sections/${sectionId}`)} className="btn btn-primary">
                <Layers className="h-4 w-4" />
                {t('up.back_to_section', 'সেকশনে ফিরুন', 'Back to section')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Upload & Preview Step */
        <div className="space-y-6">
          {/* File Picker Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{t('up.step1', '১. ফাইল নির্বাচন', '1. Choose file')}</h2>
                <p className="card-subtitle mt-0.5">
                  {t('up.cols_pre', 'প্রয়োজনীয় কলাম:', 'Required column:')} <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">url</code>
                  {' · '}
                  {t('up.cols_opt', 'ঐচ্ছিক:', 'Optional:')} <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-700">title</code>
                </p>
              </div>
            </div>

            <div className="card-body flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors ${
                  isDragging ? 'border-brand-500 bg-brand-50/60' : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className={`mb-2 h-8 w-8 ${isDragging || file ? 'text-brand-600' : 'text-slate-400'}`} />
                <span className="break-all text-sm font-medium text-slate-700">
                  {isDragging
                    ? t('up.drop', 'এখানে ছেড়ে দিন', 'Drop file here')
                    : file
                    ? file.name
                    : t('up.pick', '.csv ফাইল টেনে আনুন বা নির্বাচন করুন', 'Drag a .csv file here or browse')}
                </span>
                <span className="mt-0.5 text-xs text-slate-500">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : t('up.limits', 'সর্বোচ্চ ৫ MB', 'Max 5 MB')}
                </span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </label>

              <button type="button" disabled={!file || parsing} onClick={handleParsePreview} className="btn btn-primary w-full sm:w-auto">
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('up.checking', 'যাচাই হচ্ছে...', 'Checking...')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {t('up.preview', 'প্রিভিউ', 'Preview')}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Preview Screen */}
          {previewData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="card">
                <div className="card-header">
                  <div className="min-w-0">
                    <h3 className="card-title">{t('up.step2', '২. প্রিভিউ ও নিশ্চিতকরণ', '2. Review and confirm')}</h3>
                    <p className="card-subtitle mt-0.5 break-all">
                      <span className="font-mono">{previewData.fileName}</span> · {previewData.totalRows} {t('up.rows', 'সারি', 'rows')}
                    </p>
                  </div>

                  <button onClick={handleConfirmSave} disabled={confirming || previewData.validCount === 0} className="btn btn-primary">
                    {confirming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('up.saving', 'সংরক্ষণ হচ্ছে...', 'Saving...')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t('up.confirm', `${previewData.validCount}টি লিংক সংরক্ষণ করুন`, `Save ${previewData.validCount} links`)}
                      </>
                    )}
                  </button>
                </div>

                <div className="card-body grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label={t('up.will_insert', 'যুক্ত হবে', 'Will insert')} value={previewData.validCount} icon={<CheckCircle2 className="h-4 w-4" />} tone="brand" />
                  <StatCard label={t('up.duplicates', 'ডুপ্লিকেট', 'Duplicates')} value={previewData.duplicateCount} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
                  <StatCard label={t('up.invalid', 'অবৈধ', 'Invalid')} value={previewData.invalidCount} icon={<XCircle className="h-4 w-4" />} tone="red" />
                  <StatCard label={t('up.other_section', 'অন্য সেকশনে আছে', 'In other section')} value={previewData.warningCount} icon={<Info className="h-4 w-4" />} tone="blue" />
                </div>
              </div>

              {/* First 50 Rows Preview Table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('up.preview_rows', 'প্রথম ৫০ সারি', 'First 50 rows')}</h3>
                  <span className="card-subtitle">
                    {t('up.shown', `${previewData.previewRows.length}টি দেখানো হচ্ছে`, `${previewData.previewRows.length} shown`)}
                  </span>
                </div>

                <div className="max-h-96 overflow-auto">
                  <table className="table-pro [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50">
                    <thead>
                      <tr>
                        <th className="w-16">#</th>
                        <th>URL</th>
                        <th>{t('sec.f_title', 'শিরোনাম', 'Title')}</th>
                        <th>{t('sec.col_status', 'স্ট্যাটাস', 'Status')}</th>
                        <th>{t('up.reason', 'কারণ', 'Reason')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.previewRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="tabular-nums text-slate-500">{row.rowNumber}</td>
                          <td className="max-w-xs truncate font-mono text-xs text-slate-800" title={row.url}>
                            {row.url}
                          </td>
                          <td className="max-w-xs truncate">{row.title || '—'}</td>
                          <td className="whitespace-nowrap">
                            {row.status === 'VALID' && <span className="badge badge-green">{t('up.valid', 'বৈধ', 'Valid')}</span>}
                            {row.status === 'EXISTS_IN_OTHER_SECTION' && (
                              <span className="badge badge-blue">{t('up.other_section', 'অন্য সেকশনে আছে', 'In other section')}</span>
                            )}
                            {(row.status === 'DUPLICATE_IN_FILE' || row.status === 'DUPLICATE_IN_SECTION') && (
                              <span className="badge badge-amber">{t('up.duplicate', 'ডুপ্লিকেট', 'Duplicate')}</span>
                            )}
                            {row.status === 'INVALID' && <span className="badge badge-red">{t('up.invalid', 'অবৈধ', 'Invalid')}</span>}
                          </td>
                          <td className="text-xs text-slate-500">{row.reason || row.warning || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invalid Rows Section if any */}
              {previewData.invalidRows.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                      <h3 className="card-title">
                        {t('up.invalid_rows', 'অবৈধ সারি', 'Invalid rows')}{' '}
                        <span className="badge badge-red ml-1 align-middle">{previewData.invalidRows.length}</span>
                      </h3>
                    </div>

                    <button onClick={downloadInvalidCsv} className="btn btn-secondary btn-sm">
                      <Download className="h-3.5 w-3.5" />
                      {t('up.download_csv', 'CSV ডাউনলোড', 'Download CSV')}
                    </button>
                  </div>

                  <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto text-xs">
                    {previewData.invalidRows.map((inv) => (
                      <div key={inv.rowNumber} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2">
                        <span className="w-14 shrink-0 font-medium tabular-nums text-slate-500">
                          {t('up.row', 'সারি', 'Row')} {inv.rowNumber}
                        </span>
                        <span className="min-w-0 max-w-sm truncate font-mono text-slate-800">{inv.url || t('up.empty_url', '[খালি URL]', '[empty URL]')}</span>
                        <span className="text-rose-600">{inv.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
