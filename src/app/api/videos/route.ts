import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, VideoRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import {
  validateQueryParams,
  validateRequestBody,
  getVideosSchema,
  createVideoSchema,
  sanitizeTitle,
  sanitizeDescription,
} from "@/lib/validation";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ error: taggedError.message }, { status: 401 });
      case "MissingFieldError":
      case "ValidationError":
        return NextResponse.json({ error: taggedError.message }, { status: 400 });
      case "NotFoundError":
        return NextResponse.json({ error: taggedError.message }, { status: 404 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// GET /api/videos - Fetch paginated videos for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params with Zod schema
    const { organizationId, page, limit } = yield* validateQueryParams(getVideosSchema, request.url);

    // Fetch videos using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getVideos(organizationId, page, limit);
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}

// =============================================================================
// POST /api/videos - Create a new video
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Validate request body with Zod schema
    const validatedData = yield* validateRequestBody(createVideoSchema, request);

    // Sanitize user-provided content to prevent XSS
    const sanitizedTitle = sanitizeTitle(validatedData.title);
    const sanitizedDescription = validatedData.description
      ? sanitizeDescription(validatedData.description)
      : undefined;

    // Create video using repository
    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.createVideo({
      title: sanitizedTitle,
      description: sanitizedDescription,
      duration: validatedData.duration,
      thumbnailUrl: validatedData.thumbnailUrl ?? undefined,
      videoUrl: validatedData.videoUrl ?? undefined,
      authorId: user.id,
      organizationId: validatedData.organizationId,
      channelId: validatedData.channelId ?? undefined,
      collectionId: validatedData.collectionId ?? undefined,
      transcript: validatedData.transcript ?? undefined,
      aiSummary: validatedData.aiSummary ?? undefined,
    });
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}
