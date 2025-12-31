import { Effect } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { ForbiddenError, ValidationError, VideoRepository } from "@/lib/effect";
import { ChannelRepository } from "@/lib/effect/services/channel-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import { SeriesRepository } from "@/lib/effect/services/series-repository";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// POST /api/videos/[id]/move - Move video to a different channel/collection
// =============================================================================

/**
 * POST /api/videos/[id]/move
 *
 * Body:
 * - channelId?: string | null - The channel to move the video to (null to unassign)
 * - collectionId?: string | null - The collection to move the video to (null to unassign)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { channelId, collectionId } = body;

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const videoRepo = yield* VideoRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get the video
    const video = yield* videoRepo.getVideo(resolvedParams.id);

    // Verify user has access to this video's organization
    const isMemberResult = yield* orgRepo.isMember(session.user.id, video.organizationId);
    if (!isMemberResult) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: "Access denied",
          resource: "Video",
        }),
      );
    }

    // Validate channelId if provided
    if (channelId !== undefined && channelId !== null) {
      const channelRepo = yield* ChannelRepository;
      const channel = yield* channelRepo.getChannel(channelId);

      // Ensure channel belongs to the same organization
      if (channel.organizationId !== video.organizationId) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Channel does not belong to the same organization as the video",
            field: "channelId",
          }),
        );
      }
    }

    // Validate collectionId if provided
    if (collectionId !== undefined && collectionId !== null) {
      const seriesRepo = yield* SeriesRepository;
      const collection = yield* seriesRepo.getSeriesWithVideos(collectionId);

      // Ensure collection belongs to the same organization
      if (collection.organizationId !== video.organizationId) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Collection does not belong to the same organization as the video",
            field: "collectionId",
          }),
        );
      }
    }

    // Update the video
    const updateData: { channelId?: string | null; collectionId?: string | null } = {};
    if (channelId !== undefined) updateData.channelId = channelId;
    if (collectionId !== undefined) updateData.collectionId = collectionId;

    const updatedVideo = yield* videoRepo.updateVideo(resolvedParams.id, updateData);

    const response: ApiResponse = {
      success: true,
      data: {
        message: "Video moved successfully",
        video: updatedVideo,
      },
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
