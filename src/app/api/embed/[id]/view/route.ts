import { eq, sql } from "drizzle-orm";
import { connection, type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videoShareLinks, videos, videoViews } from "@/lib/db/schema";

// =============================================================================
// POST /api/embed/[id]/view - Track embed video view
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;

  try {
    // Generate a session ID from request fingerprint
    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const sessionId = Buffer.from(`${ip}:${userAgent}`).toString("base64").slice(0, 64);
    const referrer = request.headers.get("referer") || null;

    // Check if this is a share link
    const [shareLink] = await db
      .select({
        id: videoShareLinks.id,
        videoId: videoShareLinks.videoId,
        viewCount: videoShareLinks.viewCount,
      })
      .from(videoShareLinks)
      .where(eq(videoShareLinks.id, id));

    let videoId = id;

    if (shareLink) {
      videoId = shareLink.videoId;

      // Increment share link view count
      await db
        .update(videoShareLinks)
        .set({
          viewCount: sql`${videoShareLinks.viewCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(eq(videoShareLinks.id, id));
    }

    // Get video details
    const [video] = await db
      .select({
        id: videos.id,
        organizationId: videos.organizationId,
      })
      .from(videos)
      .where(eq(videos.id, videoId));

    if (!video) {
      return NextResponse.json({ success: false, error: "Video not found" }, { status: 404 });
    }

    // Record the view (upsert to handle duplicate sessions)
    await db
      .insert(videoViews)
      .values({
        videoId: video.id,
        organizationId: video.organizationId,
        sessionId,
        source: "embed",
        referrer,
        userAgent,
      })
      .onConflictDoUpdate({
        target: [videoViews.sessionId, videoViews.videoId],
        set: {
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.json({ success: true });

    // CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  } catch (error) {
    console.error("Embed view tracking error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
