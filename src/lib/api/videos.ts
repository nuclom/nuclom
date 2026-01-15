import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { organizations, users, videos } from '@/lib/db/schema';
import type { VideoWithAuthor, VideoWithDetails } from '@/lib/types';

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
      transcript: videos.transcript,
      transcriptSegments: videos.transcriptSegments,
      processingStatus: videos.processingStatus,
      processingError: videos.processingError,
      aiSummary: videos.aiSummary,
      aiTags: videos.aiTags,
      aiActionItems: videos.aiActionItems,
      visibility: videos.visibility,
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
        lastLoginMethod: users.lastLoginMethod,
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
      transcript: videos.transcript,
      transcriptSegments: videos.transcriptSegments,
      processingStatus: videos.processingStatus,
      processingError: videos.processingError,
      aiSummary: videos.aiSummary,
      aiTags: videos.aiTags,
      aiActionItems: videos.aiActionItems,
      visibility: videos.visibility,
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
        stripeCustomerId: users.stripeCustomerId,
        lastLoginMethod: users.lastLoginMethod,
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
    throw new Error('Video not found');
  }

  return videoData[0];
}

export async function createVideo(data: {
  title: string;
  description?: string;
  duration: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  authorId: string;
  organizationId: string;
  transcript?: string;
  aiSummary?: string;
}) {
  const newVideo = await db.insert(videos).values(data).returning();

  return newVideo[0];
}
