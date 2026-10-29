'use client';

import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

/** Shown in place of content that failed to load, with a retry button. */
export default function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { L } = useLanguage();
  return (
    <div role="alert" className="animate-fade-up flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="icon-tile icon-tile-rose mb-3 h-12 w-12 rounded-2xl">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-900">{title ?? L('তথ্য লোড করা যায়নি', 'Could not load this')}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {description ?? L('ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।', 'Check your connection and try again.')}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className="btn btn-primary mt-4 min-h-10">
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          <span>{L('আবার চেষ্টা করুন', 'Try again')}</span>
        </button>
      )}
    </div>
  );
}
