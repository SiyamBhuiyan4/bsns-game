import type { ReactNode } from 'react';

/**
 * Shimmering placeholders shown while data is in flight.
 *
 * They are shaped like the content that is coming (a stat row, table rows, a
 * chart block) so the page does not jump when the real thing lands. The
 * shimmer itself comes from the `.skeleton` utility in globals.css, which is
 * theme-aware and switched off under `prefers-reduced-motion`.
 *
 * Every wrapper takes an optional `label` — pass the already-translated
 * loading string so screen readers still hear that something is loading.
 */

/** One shimmering block. Size it with `className`. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

function Status({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </div>
  );
}

/** Placeholder row of stat cards, matching the `StatCard` grid. */
export function SkeletonStatCards({
  count = 4,
  className = 'grid grid-cols-2 gap-4 lg:grid-cols-4',
  label,
}: {
  count?: number;
  className?: string;
  label?: ReactNode;
}) {
  return (
    <Status label={label}>
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </Status>
  );
}

/** Placeholder table body: a header strip plus `rows` shimmering rows. */
export function SkeletonTable({
  rows = 6,
  cols = 5,
  label,
}: {
  rows?: number;
  cols?: number;
  label?: ReactNode;
}) {
  return (
    <Status label={label}>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-32' : 'flex-1'}`} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-3 border-t border-slate-100 pt-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-32' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </Status>
  );
}

/** Placeholder list of cards / rows, for card-based listings. */
export function SkeletonCards({
  count = 4,
  className = 'space-y-3',
  height = 'h-24',
  label,
}: {
  count?: number;
  className?: string;
  height?: string;
  label?: ReactNode;
}) {
  return (
    <Status label={label}>
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className={`${height} w-full`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}

/** Placeholder chart block: a title strip over a tall plot area. */
export function SkeletonChart({
  className = 'h-72 sm:h-80',
  label,
}: {
  className?: string;
  label?: ReactNode;
}) {
  return (
    <Status label={label}>
      <div className="p-4 sm:p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className={`w-full ${className}`} />
      </div>
    </Status>
  );
}
