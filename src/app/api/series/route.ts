import { Cause, Effect, Exit, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { CachePresets, getCacheControlHeader, parsePaginationParams } from "@/lib/api-utils";
import { MissingFieldError, SeriesRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { validateRequestBody } from "@/lib/validation";

const CreateSeriesSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  organizationId: Schema.String,
  isPublic: Schema.optional(Schema.Boolean),
});

// =============================================================================
// GET /api/series - Fetch paginated series for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const { page, limit } = parsePaginationParams(searchParams);

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Fetch series using repository
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.getSeries(organizationId, page, limit);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === "Some"
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          "Cache-Control": getCacheControlHeader(CachePresets.shortWithSwr()),
        },
      }),
  });
}

// =============================================================================
// POST /api/series - Create a new series
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate request body
    const { name, description, thumbnailUrl, organizationId, isPublic } = yield* validateRequestBody(
      CreateSeriesSchema,
      request,
    );

    // Create series using repository
    const seriesRepo = yield* SeriesRepository;
    return yield* seriesRepo.createSeries({
      name,
      description,
      thumbnailUrl,
      organizationId,
      createdById: user.id,
      isPublic: isPublic ?? false,
    });
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      return error._tag === "Some"
        ? mapErrorToApiResponse(error.value)
        : mapErrorToApiResponse(new Error("Internal server error"));
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}
