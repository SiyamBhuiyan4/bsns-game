import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';

/**
 * Shown while the server renders the admin dashboard. The blocks are shaped
 * like the real page — header, quick-stat row, period selector, section cards,
 * chart panels — so nothing jumps when the data lands.
 */
export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>
        <Skeleton className="h-6 w-40 rounded-full" />
      </div>

      {/* Quick stats */}
      <SkeletonStatCards count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />

      {/* Period selector */}
      <Skeleton className="h-12 w-full rounded-2xl" />

      {/* Section overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card space-y-4 p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      {/* Chart panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card p-5">
            <Skeleton className="mb-4 h-4 w-40" />
            <Skeleton className="h-60 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
