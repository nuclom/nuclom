import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, createPublicLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import type { MomentType } from "@/lib/db/schema";
import { ClipRepository, VideoRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { validateQueryParams, validateRequestBody } from "@/lib/validation";
import { createClipSchema, PaginationSchema } from "@/lib/validation/schemas";

// =============================================================================
// GET /api/videos/[id]/clips - List all clips for a video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: videoId } = yield* Effect.promise(() => params);

    // Validate pagination params
    const queryParams = yield* validateQueryParams(PaginationSchema, request.url);

    // Get clips
    const clipRepo = yield* ClipRepository;
    const result = yield* clipRepo.getClips(videoId, queryParams.page, queryParams.limit);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/clips - Create a new clip from a video
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Verify video exists and get organization
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    // Validate request body
    const validatedData = yield* validateRequestBody(createClipSchema, request);

    // Create clip
    const clipRepo = yield* ClipRepository;
    const newClip = yield* clipRepo.createClip({
      videoId,
      organizationId: video.organizationId,
      title: validatedData.title,
      description: validatedData.description ?? undefined,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      momentId: validatedData.momentId ?? undefined,
      momentType: validatedData.momentType as MomentType | undefined,
      transcriptExcerpt: validatedData.transcriptExcerpt ?? undefined,
      createdBy: user.id,
    });

    return newClip;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json({ success: true, data }, { status: 201 }),
  });
}
