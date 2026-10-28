'use client';

import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton, SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';

/**
 * Small pieces shared by the daily / weekly / monthly admin reports so the
 * three pages look and behave the same.
 */

/** Excel + PDF downloads and a Print button, hidden when the page is printed. */
export function ReportExportButtons({
  excelHref,
  pdfHref,
  showPrint = true,
  newTab = false,
}: {
  excelHref?: string;
  pdfHref?: string;
  showPrint?: boolean;
  /** Open the files in a new tab instead of downloading them. */
  newTab?: boolean;
}) {
  const linkProps = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : { download: true };
  const { L } = useLanguage();
  return (
    <div className="no-print flex items-center gap-2">
      {excelHref && (
        <a href={excelHref} {...linkProps} className="btn btn-secondary">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </a>
      )}
      {pdfHref && (
        <a href={pdfHref} {...linkProps} className="btn btn-secondary">
          <Download className="h-4 w-4" />
          PDF
        </a>
      )}
      {showPrint && (
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-icon border border-slate-300 bg-white"
          aria-label={L('প্রিন্ট করুন', 'Print')}
          title={L('প্রিন্ট করুন', 'Print')}
        >
          <Printer className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Whole-page placeholder for a report while its route is still resolving. */
export function ReportPageSkeleton() {
  const { L } = useLanguage();
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">{L('লোড হচ্ছে…', 'Loading…')}</span>
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <SkeletonStatCards count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />
      <div className="card overflow-hidden">
        <SkeletonTable rows={6} cols={6} />
      </div>
    </div>
  );
}
