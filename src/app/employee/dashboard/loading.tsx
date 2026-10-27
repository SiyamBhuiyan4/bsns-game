import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';

/**
 * Shown while the server renders the employee dashboard: header, quick stats,
 * arena banner, the three shortcut tiles, then the section cards.
 */
export default function EmployeeDashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <Skeleton className="h-6 w-36 rounded-full" />
      </div>

      <SkeletonStatCards count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />

      {/* Arena banner */}
      <Skeleton className="h-24 w-full rounded-2xl" />

      {/* Shortcut tiles */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-12 w-full rounded-2xl" />

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
          </div>
        ))}
      </div>
    </div>
  );
}
