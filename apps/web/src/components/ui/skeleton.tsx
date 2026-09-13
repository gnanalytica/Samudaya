import { cn } from '@/lib/utils';

/**
 * Placeholder shapes shown while a page renders on the server. They mirror the
 * PageHeader + PageBody layout so content swaps in without the page jumping.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('bg-surface-sunken animate-pulse rounded-md', className)} />
  );
}

function HeaderSkeleton() {
  return (
    <div className="border-border-base border-b px-4 py-5 md:px-6">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
    </div>
  );
}

/** A page of cards or rows: lists, queues, settings. */
export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <HeaderSkeleton />
      <div className="space-y-3 px-4 py-5 md:px-6">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="border-border-base bg-surface-raised flex items-center gap-3 rounded-xl border p-4"
          >
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** An event: summary figures, tabs, then a list. */
export function DetailPageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <HeaderSkeleton />
      <div className="space-y-5 px-4 py-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-border-base bg-surface-raised rounded-xl border p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-24" />
            </div>
          ))}
        </div>
        <div className="border-border-base flex gap-4 border-b pb-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-5 w-16" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
