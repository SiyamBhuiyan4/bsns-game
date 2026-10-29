'use client';

import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';
import { useLanguage } from '@/components/LanguageContext';

/**
 * Generic page placeholder shown the instant a section link is clicked, while
 * the server answers. Shaped like most sections: header, stat row, a table.
 */
export default function PageSkeleton() {
  const { L } = useLanguage();
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-72" />
        </div>
      </div>
      <SkeletonStatCards count={4} />
      <div className="card space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
