import { Cause, Effect, Exit } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, ForbiddenError, ValidationError, VideoRepository } from "@/lib/effect";
import { ChannelRepository } from "@/lib/effect/services/channel-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import { SeriesRepository } from "@/lib/effect/services/series-repository";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "ForbiddenError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 403 });
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "ValidationError":
      case "MissingFieldError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

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

    return {
      message: "Video moved successfully",
      video: updatedVideo,
    };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
