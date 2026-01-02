/**
 * Speaker Analytics API
 *
 * Organization-wide speaker analytics including participation trends,
 * speaking patterns, and team balance metrics.
 */

import { desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { speakerProfiles, videoSpeakers } from "@/lib/db/schema";
import { DatabaseError } from "@/lib/effect";

// =============================================================================
// GET /api/analytics/speakers - Get organization-wide speaker statistics
// =============================================================================

export async function GET(request: NextRequest) {
  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user || !session.session?.activeOrganizationId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  const effect = Effect.gen(function* () {
    // Get all speaker profiles for the organization
    const profiles = yield* Effect.tryPromise({
      try: () =>
        db.query.speakerProfiles.findMany({
          where: eq(speakerProfiles.organizationId, organizationId),
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: [desc(speakerProfiles.createdAt)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch speaker profiles",
          operation: "getSpeakerProfiles",
          cause: error,
        }),
    });

    // Get aggregated stats for each profile
    const speakerStats = yield* Effect.all(
      profiles.map((profile) =>
        Effect.tryPromise({
          try: async () => {
            // Get all video speakers linked to this profile
            const videoSpeakersData = await db.query.videoSpeakers.findMany({
              where: eq(videoSpeakers.speakerProfileId, profile.id),
              with: {
                video: {
                  columns: {
                    id: true,
                    title: true,
                    createdAt: true,
                  },
                },
              },
            });

            // Apply date filters if provided
            const filteredSpeakers = videoSpeakersData.filter((vs) => {
              if (!vs.video) return false;
              const videoDate = vs.video.createdAt;
              if (startDate && videoDate < startDate) return false;
              if (endDate && videoDate > endDate) return false;
              return true;
            });

            const videoCount = filteredSpeakers.length;
            const totalSpeakingTime = filteredSpeakers.reduce((sum, vs) => sum + vs.totalSpeakingTime, 0);
            const avgSpeakingPercentage =
              videoCount > 0
                ? Math.round(filteredSpeakers.reduce((sum, vs) => sum + (vs.speakingPercentage || 0), 0) / videoCount)
                : 0;

            return {
              speakerId: profile.id,
              displayName: profile.displayName,
              linkedUser: profile.user
                ? {
                    id: profile.user.id,
                    name: profile.user.name,
                    email: profile.user.email,
                    image: profile.user.image,
                  }
                : null,
              videoCount,
              totalSpeakingTime, // seconds
              avgSpeakingPercentage,
              recentVideos: filteredSpeakers.slice(0, 5).map((vs) => ({
                videoId: vs.video?.id,
                videoTitle: vs.video?.title,
                speakingTime: vs.totalSpeakingTime,
                speakingPercentage: vs.speakingPercentage,
              })),
            };
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to get speaker stats",
              operation: "getSpeakerStats",
              cause: error,
            }),
        }),
      ),
    );

    // Sort by total speaking time and apply limit
    const sortedStats = speakerStats.sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime).slice(0, limit);

    // Calculate organization-wide metrics
    const totalSpeakers = profiles.length;
    const linkedSpeakers = profiles.filter((p) => p.userId).length;
    const totalSpeakingTime = speakerStats.reduce((sum, s) => sum + s.totalSpeakingTime, 0);
    const totalVideosWithSpeakers = new Set(
      speakerStats.flatMap((s) => s.recentVideos.map((v) => v.videoId).filter(Boolean)),
    ).size;

    return {
      success: true,
      data: {
        organizationId,
        summary: {
          totalSpeakers,
          linkedSpeakers,
          unlinkedSpeakers: totalSpeakers - linkedSpeakers,
          totalSpeakingTime,
          totalVideosWithSpeakers,
        },
        speakers: sortedStats,
        filters: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          limit,
        },
      },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
