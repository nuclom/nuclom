import { VideoCard } from "@/components/video-card";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";
import { getVideos } from "@/lib/api/videos";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

// Video section with proper error handling
function VideoSection({
  title,
  videos,
  organization,
  loading,
  error,
}: {
  title: string;
  videos: VideoWithAuthor[];
  organization: string;
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
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button asChild>
            <Link href={`/${organization}/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload first video
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  if (videos.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-bold mb-6">{title}</h2>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No videos found. Upload your first video to get started.</p>
          <Button asChild>
            <Link href={`/${organization}/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload first video
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} organization={organization} />
        ))}
      </div>
    </section>
  );
}

export default async function OrganizationPage({ params }: { params: Promise<{ organization: string }> }) {
  const { organization: organizationSlug } = await params;

  // Get session and user
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  // Get organization by slug
  const organization = await db.select().from(organizations).where(eq(organizations.slug, organizationSlug)).limit(1);

  if (!organization.length) {
    redirect("/");
  }

  const organizationId = organization[0].id;

  // Get videos for this organization
  let videos: VideoWithAuthor[] = [];
  let error: string | null = null;

  try {
    const result = await getVideos(organizationId);
    videos = result.data;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load videos";
  }

  return (
    <div className="space-y-12">
      <VideoSection
        title="Continue watching"
        videos={videos.slice(0, 2)}
        organization={organizationSlug}
        loading={false}
        error={error}
      />
      <VideoSection
        title="New this week"
        videos={videos}
        organization={organizationSlug}
        loading={false}
        error={error}
      />
      <VideoSection
        title="From your channels"
        videos={videos.slice(1, 4)}
        organization={organizationSlug}
        loading={false}
        error={error}
      />
    </div>
  );
}
