'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import ErrorState from '@/components/ui/ErrorState';
import { useLanguage } from '@/components/LanguageContext';

/** Catches a crash on any employee page and offers a retry, inside the normal shell. */
export default function EmployeeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { L } = useLanguage();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-xl">
      <ErrorState
        title={L('পেজটি দেখাতে সমস্যা হয়েছে', 'Something went wrong on this page')}
        description={L(
          'আবার চেষ্টা করুন। সমস্যা থাকলে কিছুক্ষণ পর আবার খুলুন বা অ্যাডমিনকে জানান।',
          'Please try again. If it keeps happening, reopen the page in a little while or tell your admin.'
        )}
        onRetry={reset}
      />
      <div className="-mt-6 flex justify-center pb-8">
        <Link href="/employee/dashboard" className="btn btn-ghost min-h-10 text-brand-700">
          <LayoutDashboard className="h-4 w-4" />
          {L('ড্যাশবোর্ডে ফিরে যান', 'Back to dashboard')}
        </Link>
      </div>
    </div>
  );
}
