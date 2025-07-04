"use client";

import { useEffect, useState } from "react";
import { VideoCard } from "@/components/video-card";

import { mockVideoApi } from "@/lib/mock-data";
import type { VideoWithAuthor } from "@/lib/types";

// Loading component
function VideoSectionSkeleton() {
  return (
    <section>
      <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="space-y-3">
            <div className="aspect-video bg-muted animate-pulse rounded-lg" />
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 bg-muted animate-pulse rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VideoSection({
  title,
  videos,
  workspace,
  loading,
  error,
}: {
  title: string;
  videos: VideoWithAuthor[];
  workspace: string;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return <VideoSectionSkeleton />;
  }

  if (error) {
    return (
      <section>
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-700">
          Error loading videos: {error}
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {videos.map((video) => (
          <VideoCard key={video.id} {...video} workspace={workspace} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const [videos, setVideos] = useState<VideoWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get workspace from params
        const { workspace: workspaceSlug } = await params;
        setWorkspace(workspaceSlug);

        setLoading(true);
        setError(null);

        // For now, use mock data since database may not be set up
        // In production, this would use: useVideos({ workspaceId: workspaceSlug })
        const result = await mockVideoApi.getVideos();
        setVideos(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load videos");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [params]);

  return (
    <div className="space-y-12">
      <VideoSection
        title="Continue watching"
        videos={videos.slice(0, 2)}
        workspace={workspace}
        loading={loading}
        error={error}
      />
      <VideoSection
        title="New this week"
        videos={videos}
        workspace={workspace}
        loading={loading}
        error={error}
      />
      <VideoSection
        title="From your channels"
        videos={videos.slice(1, 4)}
        workspace={workspace}
        loading={loading}
        error={error}
      />
    </div>
  );
}
