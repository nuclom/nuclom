import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, videoShareLinks, videos } from "@/lib/db/schema";

// =============================================================================
// GET /api/embed/[id] - Get embed video data
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    // First try to find as a share link
    const [shareLink] = await db
      .select({
        id: videoShareLinks.id,
        videoId: videoShareLinks.videoId,
        accessLevel: videoShareLinks.accessLevel,
        status: videoShareLinks.status,
        expiresAt: videoShareLinks.expiresAt,
        maxViews: videoShareLinks.maxViews,
        viewCount: videoShareLinks.viewCount,
      })
      .from(videoShareLinks)
      .where(eq(videoShareLinks.id, id));

    let videoId = id;
    let isShareLink = false;

    if (shareLink) {
      // Validate share link
      if (shareLink.status !== "active") {
        return NextResponse.json({ success: false, error: "This video is no longer available" }, { status: 410 });
      }

      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        return NextResponse.json({ success: false, error: "This video link has expired" }, { status: 410 });
      }

      if (shareLink.maxViews && (shareLink.viewCount ?? 0) >= shareLink.maxViews) {
        return NextResponse.json({ success: false, error: "This video has reached its view limit" }, { status: 410 });
      }

      videoId = shareLink.videoId;
      isShareLink = true;
    }

    // Get video data
    const [video] = await db
      .select({
        id: videos.id,
        title: videos.title,
        videoUrl: videos.videoUrl,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        organizationId: videos.organizationId,
      })
      .from(videos)
      .where(eq(videos.id, videoId));

    if (!video || !video.videoUrl) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Get organization
    const [org] = await db
      .select({
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, video.organizationId));

    // Return embed data with CORS headers for iframe embedding
    const response = NextResponse.json({
      success: true,
      data: {
        id: video.id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        organization: {
          name: org?.name || "Unknown",
          slug: org?.slug || "",
        },
        isShareLink,
      },
    });

    // Allow embedding from any origin
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Embed API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
