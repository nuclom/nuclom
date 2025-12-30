import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { SearchFilters } from "@/lib/db/schema";
import { AppLive, MissingFieldError, SearchRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";

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
// GET /api/search - Search videos with full-text search
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const organizationId = searchParams.get("organizationId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    // Parse filters
    const authorId = searchParams.get("authorId");
    const channelId = searchParams.get("channelId");
    const collectionId = searchParams.get("collectionId");
    const processingStatus = searchParams.get("processingStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const hasTranscript = searchParams.get("hasTranscript");
    const hasAiSummary = searchParams.get("hasAiSummary");
    const sortBy = searchParams.get("sortBy") as SearchFilters["sortBy"];
    const sortOrder = searchParams.get("sortOrder") as SearchFilters["sortOrder"];

    const filters: SearchFilters = {
      ...(authorId && { authorId }),
      ...(channelId && { channelId }),
      ...(collectionId && { collectionId }),
      ...(processingStatus && { processingStatus }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      ...(hasTranscript === "true" && { hasTranscript: true }),
      ...(hasAiSummary === "true" && { hasAiSummary: true }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
    };

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Perform search
    const searchRepo = yield* SearchRepository;
    const results = yield* searchRepo.search({
      query,
      organizationId,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      page,
      limit,
    });

    // Save search to history if query is not empty
    if (query.trim()) {
      yield* searchRepo
        .saveSearchHistory({
          userId: user.id,
          organizationId,
          query: query.trim(),
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          resultsCount: results.total,
        })
        .pipe(Effect.catchAll(() => Effect.succeed(null))); // Ignore history save errors
    }

    return results;
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
