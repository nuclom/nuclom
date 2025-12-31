import { and, desc, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  comments,
  dataExportRequests,
  legalConsents,
  members,
  organizations,
  users,
  videoProgresses,
  videos,
} from "@/lib/db/schema";

// Rate limit: 1 export per 24 hours
const EXPORT_RATE_LIMIT_HOURS = 24;

export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check rate limit - look for exports in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000);
    const recentExports = await db
      .select()
      .from(dataExportRequests)
      .where(and(eq(dataExportRequests.userId, userId), gte(dataExportRequests.createdAt, twentyFourHoursAgo)))
      .limit(1);

    if (recentExports.length > 0) {
      const lastExport = recentExports[0];
      const timeRemaining = Math.ceil(
        (lastExport.createdAt.getTime() + EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000),
      );

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You can only request one data export every ${EXPORT_RATE_LIMIT_HOURS} hours. Please try again in ${timeRemaining} hours.`,
          nextAvailable: new Date(
            lastExport.createdAt.getTime() + EXPORT_RATE_LIMIT_HOURS * 60 * 60 * 1000,
          ).toISOString(),
        },
        { status: 429 },
      );
    }

    // Fetch user data
    const [userData] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch user's organizations
    const userMemberships = await db
      .select({
        member: members,
        organization: organizations,
      })
      .from(members)
      .innerJoin(organizations, eq(members.organizationId, organizations.id))
      .where(eq(members.userId, userId));

    // Fetch user's videos
    const userVideos = await db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        duration: videos.duration,
        thumbnailUrl: videos.thumbnailUrl,
        videoUrl: videos.videoUrl,
        transcript: videos.transcript,
        aiSummary: videos.aiSummary,
        createdAt: videos.createdAt,
        updatedAt: videos.updatedAt,
      })
      .from(videos)
      .where(eq(videos.authorId, userId))
      .orderBy(desc(videos.createdAt));

    // Fetch user's comments
    const userComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        timestamp: comments.timestamp,
        videoId: comments.videoId,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt));

    // Fetch user's video progress
    const userProgress = await db
      .select({
        videoId: videoProgresses.videoId,
        currentTime: videoProgresses.currentTime,
        completed: videoProgresses.completed,
        lastWatchedAt: videoProgresses.lastWatchedAt,
      })
      .from(videoProgresses)
      .where(eq(videoProgresses.userId, userId));

    // Fetch user's legal consents
    const userConsents = await db
      .select({
        documentType: legalConsents.documentType,
        version: legalConsents.version,
        acceptedAt: legalConsents.acceptedAt,
      })
      .from(legalConsents)
      .where(eq(legalConsents.userId, userId))
      .orderBy(desc(legalConsents.acceptedAt));

    // Compile the export data
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        userId: userId,
        format: "JSON",
        version: "1.0",
      },
      profile: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.emailVerified,
        image: userData.image,
        role: userData.role,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        marketingConsent: userData.marketingConsent,
        marketingConsentAt: userData.marketingConsentAt,
      },
      organizations: userMemberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.member.role,
        joinedAt: m.member.createdAt,
      })),
      videos: userVideos.map((v) => ({
        ...v,
        note: "Video file URLs are signed and will expire. Download your videos separately if needed.",
      })),
      comments: userComments,
      videoProgress: userProgress,
      legalConsents: userConsents,
      settings: {
        marketingConsent: userData.marketingConsent,
        marketingConsentAt: userData.marketingConsentAt,
      },
    };

    // Record the export request
    await db.insert(dataExportRequests).values({
      userId,
      status: "completed",
      completedAt: new Date(),
    });

    // Return the data as JSON
    return NextResponse.json(exportData, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="nuclom-data-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json({ error: "Failed to export data. Please try again later." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // POST method for requesting an async export (for larger datasets)
  // For now, redirect to GET which handles synchronous export
  return GET(request);
}
