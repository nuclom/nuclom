import { db } from "@/lib/db";
import { videos, users, workspaces, channels, collections, comments } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { VideoWithAuthor, VideoWithDetails } from "@/lib/types";

export async function getVideos(workspaceId: string, page = 1, limit = 20) {
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
      workspaceId: videos.workspaceId,
      channelId: videos.channelId,
      collectionId: videos.collectionId,
      transcript: videos.transcript,
      aiSummary: videos.aiSummary,
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
      },
    })
    .from(videos)
    .innerJoin(users, eq(videos.authorId, users.id))
    .where(eq(videos.workspaceId, workspaceId))
    .orderBy(desc(videos.createdAt))
    .offset(offset)
    .limit(limit);

  const totalCount = await db
    .select()
    .from(videos)
    .where(eq(videos.workspaceId, workspaceId));

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
      workspaceId: videos.workspaceId,
      channelId: videos.channelId,
      collectionId: videos.collectionId,
      transcript: videos.transcript,
      aiSummary: videos.aiSummary,
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
      },
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        description: workspaces.description,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      },
    })
    .from(videos)
    .innerJoin(users, eq(videos.authorId, users.id))
    .innerJoin(workspaces, eq(videos.workspaceId, workspaces.id))
    .where(eq(videos.id, id))
    .limit(1);

  if (!videoData.length) {
    throw new Error("Video not found");
  }

  // Get channel if exists
  let channel = null;
  if (videoData[0].channelId) {
    const channelData = await db
      .select()
      .from(channels)
      .where(eq(channels.id, videoData[0].channelId))
      .limit(1);
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
  workspaceId: string;
  channelId?: string;
  collectionId?: string;
  transcript?: string;
  aiSummary?: string;
}) {
  const newVideo = await db
    .insert(videos)
    .values(data)
    .returning();

  return newVideo[0];
}
