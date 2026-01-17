import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_500px] 2xl:grid-cols-[1fr_600px] gap-6 lg:h-[calc(100vh-6rem)]">
      {/* Left column - Header and tabs */}
      <div className="lg:col-start-1 lg:row-start-1 flex flex-col lg:min-h-0">
        {/* Header */}
        <header className="lg:pb-4">
          {/* Title and share button */}
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-7 sm:h-8 w-3/4" />
            <div className="flex items-center gap-1 shrink-0">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          {/* Author info */}
          <div className="flex items-center gap-3 mt-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-2" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-2" />
            <Skeleton className="h-4 w-12" />
          </div>
          {/* Tags */}
          <div className="flex items-center gap-1.5 mt-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </header>

        {/* Tabs */}
        <div className="w-full flex-1 flex flex-col lg:min-h-0">
          <div className="flex items-center gap-0 border-b">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
          {/* Tab content - summary */}
          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* Right column - Video player */}
      <div className="lg:col-start-2 lg:row-start-1">
        <div className="lg:sticky lg:top-4 space-y-4">
          {/* Video player */}
          <Skeleton className="aspect-video w-full rounded-xl" />
          {/* Jump to section */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
