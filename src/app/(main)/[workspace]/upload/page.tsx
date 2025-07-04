"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { VideoUpload } from "@/components/video-upload";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function UploadPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const router = useRouter();
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("");

  // Use the params promise
  React.useEffect(() => {
    params.then(({ workspace }) => {
      setWorkspaceSlug(workspace);
    });
  }, [params]);

  const handleUploadComplete = (result: {
    videoId: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: string;
  }) => {
    // Redirect to the newly uploaded video
    router.push(`/${workspaceSlug}/videos/${result.videoId}`);
  };

  const handleCancel = () => {
    router.push(`/${workspaceSlug}`);
  };

  // For now, we'll use mock user data - in production this would come from authentication
  const mockAuthorId = "user-123";
  const mockWorkspaceId = "workspace-123";

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Videos
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Upload Video</h1>
          <p className="text-muted-foreground">
            Upload a new video to your workspace
          </p>
        </div>

        {/* Upload Component */}
        <VideoUpload
          workspaceId={mockWorkspaceId}
          authorId={mockAuthorId}
          onUploadComplete={handleUploadComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
