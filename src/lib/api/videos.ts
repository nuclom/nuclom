import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { channels, collections, comments, organizations, users, videos } from "@/lib/db/schema";
import type { VideoWithAuthor, VideoWithDetails } from "@/lib/types";

export async function getVideos(organizationId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const videosData = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      duration: videos.duration,
      thumbnailUrl: videos.thumbnailUrl,
      videoUrl: videos.videoUrl,
      authorId: videos.authorId,
      organizationId: videos.organizationId,
      channelId: videos.channelId,
      collectionId: videos.collectionId,
      transcript: videos.transcript,
      transcriptSegments: videos.transcriptSegments,
      processingStatus: videos.processingStatus,
      processingError: videos.processingError,
      aiSummary: videos.aiSummary,
      aiTags: videos.aiTags,
      aiActionItems: videos.aiActionItems,
      createdAt: videos.createdAt,
      updatedAt: videos.updatedAt,
      author: {
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        emailVerified: users.emailVerified,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        twoFactorEnabled: users.twoFactorEnabled,
        tosAcceptedAt: users.tosAcceptedAt,
        tosVersion: users.tosVersion,
        privacyAcceptedAt: users.privacyAcceptedAt,
        privacyVersion: users.privacyVersion,
        marketingConsentAt: users.marketingConsentAt,
        marketingConsent: users.marketingConsent,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
        warnedAt: users.warnedAt,
        warningReason: users.warningReason,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
        maxSessions: users.maxSessions,
        passwordChangedAt: users.passwordChangedAt,
      },
    })
    .from(videos)
    .innerJoin(users, eq(videos.authorId, users.id))
    .where(eq(videos.organizationId, organizationId))
    .orderBy(desc(videos.createdAt))
    .offset(offset)
    .limit(limit);

  const totalCount = await db.select().from(videos).where(eq(videos.organizationId, organizationId));

  return {
    data: videosData as VideoWithAuthor[],
    pagination: {
      page,
      limit,
      total: totalCount.length,
      totalPages: Math.ceil(totalCount.length / limit),
    },
  };
}

export async function getVideo(id: string): Promise<VideoWithDetails> {
  const videoData = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      duration: videos.duration,
      thumbnailUrl: videos.thumbnailUrl,
      videoUrl: videos.videoUrl,
      authorId: videos.authorId,
      organizationId: videos.organizationId,
      channelId: videos.channelId,
      collectionId: videos.collectionId,
      transcript: videos.transcript,
      transcriptSegments: videos.transcriptSegments,
      processingStatus: videos.processingStatus,
      processingError: videos.processingError,
      aiSummary: videos.aiSummary,
      aiTags: videos.aiTags,
      aiActionItems: videos.aiActionItems,
      deletedAt: videos.deletedAt,
      retentionUntil: videos.retentionUntil,
      createdAt: videos.createdAt,
      updatedAt: videos.updatedAt,
      author: {
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        emailVerified: users.emailVerified,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        twoFactorEnabled: users.twoFactorEnabled,
        tosAcceptedAt: users.tosAcceptedAt,
        tosVersion: users.tosVersion,
        privacyAcceptedAt: users.privacyAcceptedAt,
        privacyVersion: users.privacyVersion,
        marketingConsentAt: users.marketingConsentAt,
        marketingConsent: users.marketingConsent,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
        warnedAt: users.warnedAt,
        warningReason: users.warningReason,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
        stripeCustomerId: users.stripeCustomerId,
        maxSessions: users.maxSessions,
        passwordChangedAt: users.passwordChangedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logo: organizations.logo,
        createdAt: organizations.createdAt,
        metadata: organizations.metadata,
      },
    })
    .from(videos)
    .innerJoin(users, eq(videos.authorId, users.id))
    .innerJoin(organizations, eq(videos.organizationId, organizations.id))
    .where(eq(videos.id, id))
    .limit(1);

  if (!videoData.length) {
    throw new Error("Video not found");
  }

  // Get channel if exists
  let channel = null;
  if (videoData[0].channelId) {
    const channelData = await db.select().from(channels).where(eq(channels.id, videoData[0].channelId)).limit(1);
    channel = channelData[0] || null;
  }

  // Get collection if exists
  let collection = null;
  if (videoData[0].collectionId) {
    const collectionData = await db
      .select()
      .from(collections)
      .where(eq(collections.id, videoData[0].collectionId))
      .limit(1);
    collection = collectionData[0] || null;
  }

  // Get comments
  const commentsData = await db
    .select({
      id: comments.id,
      content: comments.content,
      timestamp: comments.timestamp,
      authorId: comments.authorId,
      videoId: comments.videoId,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        emailVerified: users.emailVerified,
        role: users.role,
        banned: users.banned,
        banReason: users.banReason,
        banExpires: users.banExpires,
        twoFactorEnabled: users.twoFactorEnabled,
        tosAcceptedAt: users.tosAcceptedAt,
        tosVersion: users.tosVersion,
        privacyAcceptedAt: users.privacyAcceptedAt,
        privacyVersion: users.privacyVersion,
        marketingConsentAt: users.marketingConsentAt,
        marketingConsent: users.marketingConsent,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
        warnedAt: users.warnedAt,
        warningReason: users.warningReason,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
        stripeCustomerId: users.stripeCustomerId,
        maxSessions: users.maxSessions,
        passwordChangedAt: users.passwordChangedAt,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.videoId, id))
    .orderBy(desc(comments.createdAt));

  return {
    ...videoData[0],
    channel,
    collection,
    comments: commentsData,
  };
}

export async function createVideo(data: {
  title: string;
  description?: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  authorId: string;
  organizationId: string;
  channelId?: string;
  collectionId?: string;
  transcript?: string;
  aiSummary?: string;
}) {
  const newVideo = await db.insert(videos).values(data).returning();

  return newVideo[0];
}
