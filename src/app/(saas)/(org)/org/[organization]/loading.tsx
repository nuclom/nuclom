import { Skeleton } from '@/components/ui/skeleton';

function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      {/* Video thumbnail */}
      <div className="relative aspect-video bg-muted animate-pulse rounded-xl" />
      {/* Content with avatar */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-4 bg-muted animate-pulse rounded w-full" />
          <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
          {/* Author */}
          <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
          {/* Date */}
          <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

function VideoSectionSkeleton({ cardCount = 4 }: { cardCount?: number }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          {/* Section title */}
          <Skeleton className="h-6 w-40" />
          {/* Section description */}
          <Skeleton className="h-4 w-56" />
        </div>
        {/* View all button */}
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: cardCount }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-4">
      {/* Getting Started Checklist skeleton */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
      {/* Activity Feed skeleton */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <Skeleton className="h-5 w-28" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Main grid: Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main Section */}
        <div className="space-y-10">
          {/* Continue Watching section */}
          <VideoSectionSkeleton cardCount={4} />
          {/* New This Week section */}
          <VideoSectionSkeleton cardCount={4} />
          {/* From Your Channels section */}
          <VideoSectionSkeleton cardCount={4} />
        </div>

        {/* Sidebar - Right side (desktop) */}
        <div className="hidden lg:block">
          <SidebarSkeleton />
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <SidebarSkeleton />
      </div>
    </div>
  );
}
