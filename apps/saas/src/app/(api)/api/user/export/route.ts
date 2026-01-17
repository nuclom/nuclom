import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apikeys, notifications, userPreferences, users, videoProgresses, videos } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

// =============================================================================
// POST /api/user/export - Export all user data (GDPR compliance)
// =============================================================================

export async function POST() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Gather all user data
    const [userData, userPrefs, userVideos, userProgress, userNotifications, userApiKeys] = await Promise.all([
      // User profile
      db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      // User preferences
      db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      }),
      // User's videos
      db.query.videos.findMany({
        where: eq(videos.authorId, userId),
        columns: {
          id: true,
          title: true,
          description: true,
          duration: true,
          thumbnailUrl: true,
          videoUrl: true,
          transcript: true,
          aiSummary: true,
          aiTags: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      // User's video progress
      db.query.videoProgresses.findMany({
        where: eq(videoProgresses.userId, userId),
        columns: {
          id: true,
          videoId: true,
          currentTime: true,
          completed: true,
          lastWatchedAt: true,
        },
      }),
      // User's notifications
      db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        columns: {
          id: true,
          type: true,
          title: true,
          body: true,
          resourceType: true,
          resourceId: true,
          read: true,
          createdAt: true,
        },
      }),
      // API keys (without the actual key for security)
      db
        .select({
          id: apikeys.id,
          name: apikeys.name,
          prefix: apikeys.prefix,
          start: apikeys.start,
          enabled: apikeys.enabled,
          expiresAt: apikeys.expiresAt,
          createdAt: apikeys.createdAt,
          lastRequest: apikeys.lastRequest,
        })
        .from(apikeys)
        .where(eq(apikeys.userId, userId)),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: userData,
      preferences: userPrefs || null,
      videos: userVideos,
      videoProgress: userProgress,
      notifications: userNotifications,
      apiKeys: userApiKeys,
    };

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="nuclom-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    logger.error('Error exporting user data', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
