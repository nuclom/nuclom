"use client";

import { AlertCircle, Download, Loader2, Video } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordProtectedVideo } from "@/components/video/password-protected-video";
import { VideoPlayer } from "@/components/video/video-player";

interface ShareLinkData {
  id: string;
  videoId: string;
  accessLevel: "view" | "comment" | "download";
  status: "active" | "expired" | "revoked";
  password: boolean;
  expiresAt: string | null;
  maxViews: number | null;
  viewCount: number;
  video: {
    id: string;
    title: string;
    description: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    duration: string;
    organizationId: string;
    organization: {
      name: string;
      slug: string;
    };
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading video...</p>
      </div>
    </div>
  );
}

function SharePageContent() {
  const params = useParams();
  const shareLinkId = params.id as string;
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  // Fetch share link data
  const { data, error, isLoading } = useSWR<{ success: boolean; data: ShareLinkData; error?: string }>(
    `/api/share/${shareLinkId}`,
    fetcher,
  );

  // Check if password was already verified in this session
  useEffect(() => {
    const verified = sessionStorage.getItem(`share_verified_${shareLinkId}`);
    if (verified === "true") {
      setIsPasswordVerified(true);
    }
  }, [shareLinkId]);

  // Track view when video is accessed
  const trackView = useCallback(async () => {
    if (hasTrackedView) return;

    try {
      await fetch(`/api/share/${shareLinkId}/view`, { method: "POST" });
      setHasTrackedView(true);
    } catch (error) {
      console.error("Failed to track view:", error);
    }
  }, [shareLinkId, hasTrackedView]);

  // Track view on load (for non-password protected videos)
  useEffect(() => {
    if (data?.success && !data.data.password && !hasTrackedView) {
      trackView();
    }
  }, [data, hasTrackedView, trackView]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data?.success) {
    const errorMessage = data?.error || "This link may be invalid or has been revoked.";
    return <ErrorState title="Unable to access video" message={errorMessage} />;
  }

  const shareLink = data.data;

  // Check link status
  if (shareLink.status !== "active") {
    return <ErrorState title="Link Unavailable" message="This share link has been revoked." />;
  }

  // Check expiration
  if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
    return <ErrorState title="Link Expired" message="This share link has expired." />;
  }

  // Check view limit
  if (shareLink.maxViews && shareLink.viewCount >= shareLink.maxViews) {
    return <ErrorState title="View Limit Reached" message="This share link has reached its view limit." />;
  }

  // Check if video exists
  if (!shareLink.video || !shareLink.video.videoUrl) {
    return <ErrorState title="Video Unavailable" message="The video is not available." />;
  }

  // Handle password protection
  if (shareLink.password && !isPasswordVerified) {
    return (
      <PasswordProtectedVideo
        shareLinkId={shareLinkId}
        videoTitle={shareLink.video.title}
        onVerified={() => {
          setIsPasswordVerified(true);
          trackView();
        }}
      />
    );
  }

  const canDownload = shareLink.accessLevel === "download";
  const canComment = shareLink.accessLevel === "comment" || shareLink.accessLevel === "download";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <span className="font-semibold">Shared Video</span>
          </div>
          <span className="text-sm text-muted-foreground">Shared by {shareLink.video.organization.name}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Video Player */}
          <VideoPlayer
            url={shareLink.video.videoUrl}
            title={shareLink.video.title}
            videoId={shareLink.video.id}
            thumbnailUrl={shareLink.video.thumbnailUrl || undefined}
          />

          {/* Video Info */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{shareLink.video.title}</h1>
                <p className="text-muted-foreground mt-1">{shareLink.video.organization.name}</p>
              </div>
              {canDownload && shareLink.video.videoUrl && (
                <Button asChild>
                  <a href={shareLink.video.videoUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              )}
            </div>

            {shareLink.video.description && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{shareLink.video.description}</p>
              </div>
            )}

            {/* Access level notice */}
            <div className="text-sm text-muted-foreground">
              {canComment ? (
                <p>You can view and comment on this video.</p>
              ) : (
                <p>You can view this video. Commenting is disabled.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Powered by Nuclom - Video Collaboration Platform</p>
        </div>
      </footer>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SharePageContent />
    </Suspense>
  );
}
