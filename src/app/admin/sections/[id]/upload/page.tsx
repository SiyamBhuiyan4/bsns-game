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
} from 'lucide-react';
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
      setErrorMessage('দয়া করে শুধুমাত্র .csv ফাইল আপলোড করুন (Only .csv files supported)');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setErrorMessage('ফাইলের আকার সর্বোচ্চ ৫ মেগাবাইট হতে পারবে (Max 5MB file size limit exceeded)');
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
        setErrorMessage(data.error || 'ফাইল প্রিভিউ প্রক্রিয়া ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।');
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
        setErrorMessage(data.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
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
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
          <Link href={`/admin/sections/${sectionId}`} className="hover:text-emerald-700 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            {sectionName || 'সেকশন লিঙ্ক তালিকা'}
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-700">CSV আপলোড</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Upload className="h-6 w-6 text-emerald-600" />
          গ্রুপ লিঙ্ক CSV আপলোড (Upload CSV)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          <strong>{sectionName}</strong> সেকশনে ফেসবুক গ্রুপ লিঙ্ক বাল্ক আপলোড করুন। (সর্বোচ্চ ৫ MB, ১০,০০০ সারি)
        </p>
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

      {/* Result Screen (After Confirm) */}
      {uploadResult ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            CSV আপলোড সফলভাবে সম্পন্ন হয়েছে!
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            ডাটাবেসে গ্রুপ লিঙ্ক সংরক্ষণ করা হয়েছে এবং ইতিহাস আপডেট করা হয়েছে।
          </p>

          <div className="mt-6 mx-auto grid max-w-lg grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="text-xs font-semibold text-emerald-700">সংরক্ষিত (Inserted)</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{uploadResult.inserted} টি</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="text-xs font-semibold text-amber-700">ডুপ্লিকেট (Duplicates)</div>
              <div className="mt-1 text-2xl font-bold text-amber-900">{uploadResult.duplicates} টি</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <div className="text-xs font-semibold text-rose-700">অবৈধ (Invalid)</div>
              <div className="mt-1 text-2xl font-bold text-rose-900">{uploadResult.invalid} টি</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {uploadResult.invalid > 0 && previewData && previewData.invalidRows.length > 0 && (
              <button
                onClick={downloadInvalidCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" />
                অবৈধ সারিসমূহ CSV ডাউনলোড করুন (Download Invalid Rows)
              </button>
            )}

            <button
              onClick={() => router.push(`/admin/sections/${sectionId}`)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Layers className="h-4 w-4" />
              সেকশন লিঙ্ক তালিকায় ফিরে যান
            </button>

            <Link
              href="/admin/csv/history"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              আপলোড হিস্ট্রি দেখুন (View History)
            </Link>
          </div>
        </div>
      ) : (
        /* Upload & Preview Step */
        <div className="space-y-6">
          {/* File Picker Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-2">
              ধাপ ১: CSV ফাইল নির্বাচন করুন
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              ফাইলে অবশ্যই <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">url</code> কলাম থাকতে হবে। ঐচ্ছিক কলাম: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">title</code>
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01] shadow-inner'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30'
                }`}
              >
                <FileSpreadsheet className={`h-10 w-10 mb-2 transition-colors ${isDragging ? 'text-emerald-700 animate-bounce' : 'text-emerald-600'}`} />
                <span className="text-sm font-semibold text-slate-700">
                  {isDragging
                    ? 'CSV ফাইলটি এখানে ছেড়ে দিন (Drop file here)...'
                    : file
                    ? file.name
                    : 'কম্পিউটার থেকে .csv ফাইল টেনে আনুন বা নির্বাচন করুন (Drag & drop or browse)'}
                </span>
                <span className="text-xs text-slate-400 mt-0.5">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'সর্বোচ্চ ৫ মেগাবাইট, ১০,০০০ সারি'}
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <button
                type="button"
                disabled={!file || parsing}
                onClick={handleParsePreview}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    প্রিভিউ যাচাই হচ্ছে...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    ফাইল প্রিভিউ করুন (Preview CSV)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Preview Screen */}
          {previewData && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Summary Cards */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      ধাপ ২: আপলোড প্রিভিউ ও ফলাফল সারসংক্ষেপ
                    </h3>
                    <p className="text-xs text-slate-500">
                      ফাইল: <strong className="font-mono text-slate-800">{previewData.fileName}</strong> | মোট সারি: <strong>{previewData.totalRows}</strong>
                    </p>
                  </div>

                  <button
                    onClick={handleConfirmSave}
                    disabled={confirming || previewData.validCount === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    {confirming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        সংরক্ষণ হচ্ছে...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        নিশ্চিত করুন ও ডাটাবেসে সেভ করুন ({previewData.validCount} টি)
                      </>
                    )}
                  </button>
                </div>

                {/* Counter Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      যুক্ত হবে (Will Insert)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-emerald-900">
                      {previewData.validCount} টি
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ডুপ্লিকেট (Duplicates)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-amber-900">
                      {previewData.duplicateCount} টি
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-800">
                      <XCircle className="h-4 w-4 text-rose-600" />
                      অবৈধ (Invalid URLs)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-rose-900">
                      {previewData.invalidCount} টি
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                      <Info className="h-4 w-4 text-blue-600" />
                      অন্য সেকশনে আছে (Warnings)
                    </div>
                    <div className="mt-1 text-2xl font-bold text-blue-900">
                      {previewData.warningCount} টি
                    </div>
                  </div>
                </div>
              </div>

              {/* First 50 Rows Preview Table */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    প্রথম ৫০টি সারির প্রিভিউ (Preview of First 50 Rows)
                  </span>
                  <span className="text-xs text-slate-500">
                    {previewData.previewRows.length} টি সারি প্রদর্শিত
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4 w-16">সারি #</th>
                        <th className="py-2.5 px-4">গ্রুপ URL</th>
                        <th className="py-2.5 px-4">গ্রুপের নাম (Title)</th>
                        <th className="py-2.5 px-4 text-center">স্ট্যাটাস (Status)</th>
                        <th className="py-2.5 px-4">মন্তব্য / কারণ (Reason)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.previewRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            row.status === 'INVALID'
                              ? 'bg-rose-50/30'
                              : row.status === 'DUPLICATE_IN_FILE' || row.status === 'DUPLICATE_IN_SECTION'
                              ? 'bg-amber-50/30'
                              : row.status === 'EXISTS_IN_OTHER_SECTION'
                              ? 'bg-blue-50/20'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-4 font-mono text-slate-500">{row.rowNumber}</td>
                          <td className="py-2 px-4 font-mono text-slate-800 max-w-xs truncate" title={row.url}>
                            {row.url}
                          </td>
                          <td className="py-2 px-4 text-slate-700 max-w-xs truncate">
                            {row.title || '—'}
                          </td>
                          <td className="py-2 px-4 text-center whitespace-nowrap">
                            {row.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" /> বৈধ (Valid)
                              </span>
                            )}
                            {row.status === 'EXISTS_IN_OTHER_SECTION' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                                <Info className="h-3 w-3" /> অন্য সেকশনে আছে
                              </span>
                            )}
                            {(row.status === 'DUPLICATE_IN_FILE' || row.status === 'DUPLICATE_IN_SECTION') && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                <AlertTriangle className="h-3 w-3" /> ডুপ্লিকেট
                              </span>
                            )}
                            {row.status === 'INVALID' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                <XCircle className="h-3 w-3" /> অবৈধ (Invalid)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-slate-500 text-[11px]">
                            {row.reason || row.warning || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invalid Rows Section if any */}
              {previewData.invalidRows.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                      <AlertCircle className="h-5 w-5 text-rose-600" />
                      <span>সকল অবৈধ সারি ({previewData.invalidRows.length} টি) - সংশোধন প্রয়োজন</span>
                    </div>

                    <button
                      onClick={downloadInvalidCsv}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer shadow-xs transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      অবৈধ সারিগুলো ডাউনলোড করুন (Download CSV)
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs text-rose-900 bg-white rounded-xl p-3 border border-rose-200">
                    {previewData.invalidRows.map((inv) => (
                      <div key={inv.rowNumber} className="flex items-start gap-2 border-b border-rose-100 pb-1 last:border-0">
                        <span className="font-mono font-bold text-rose-700">সারি {inv.rowNumber}:</span>
                        <span className="font-mono truncate max-w-sm">{inv.url || '[খালি URL]'}</span>
                        <span className="text-rose-600 italic">({inv.reason})</span>
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
