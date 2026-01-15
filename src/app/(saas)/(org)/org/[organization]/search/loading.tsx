import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-80 mt-1" />
      </div>

      <div className="space-y-6">
        {/* Search input */}
        <Skeleton className="h-10 max-w-2xl rounded-md" />

        <div className="flex gap-8">
          {/* Main content - results */}
          <div className="flex-1 min-w-0 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 border rounded-lg">
                <Skeleton className="w-48 h-28 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <aside className="w-72 flex-shrink-0 space-y-8">
            {/* Filters skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-5 w-16" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>

            {/* Saved searches skeleton */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
