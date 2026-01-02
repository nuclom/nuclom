import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { connection, type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { AppLive, KnowledgeGraphRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { validateQueryParams } from "@/lib/validation";

// =============================================================================
// Query Schema
// =============================================================================

const getTimelineQuerySchema = Schema.Struct({
  organizationId: Schema.String,
  topic: Schema.optional(Schema.String),
  personId: Schema.optional(Schema.String),
  from: Schema.optional(Schema.String), // ISO date string
  to: Schema.optional(Schema.String), // ISO date string
  page: Schema.optionalWith(Schema.NumberFromString.pipe(Schema.int(), Schema.positive()), { default: () => 1 }),
  limit: Schema.optionalWith(
    Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(100)),
    { default: () => 50 },
  ),
});

// =============================================================================
// GET /api/knowledge/timeline - Get decision timeline
// =============================================================================

export async function GET(request: NextRequest) {
  await connection();

  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Validate query params
    const params = yield* validateQueryParams(getTimelineQuerySchema, request.url);

    // Parse dates if provided
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;

    // Fetch timeline
    const repo = yield* KnowledgeGraphRepository;
    const timeline = yield* repo.getDecisionTimeline(params.organizationId, {
      topic: params.topic,
      personId: params.personId,
      from,
      to,
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
    });

    return {
      timeline,
      page: params.page,
      limit: params.limit,
      hasMore: timeline.length === params.limit,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}
