import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { CachePresets, getCacheControlHeader, parsePaginationParams } from "@/lib/api-utils";
import { MissingFieldError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";
import type { DecisionFilters } from "@/lib/types";

// =============================================================================
// GET /api/decisions - Fetch paginated decisions for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    // Parse query params
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

    // Build filters
    const filters: DecisionFilters = {};

    const status = searchParams.get("status");
    if (status === "decided" || status === "proposed" || status === "superseded") {
      filters.status = status;
    }

    const source = searchParams.get("source");
    if (source === "meeting" || source === "adhoc" || source === "manual") {
      filters.source = source;
    }

    const topics = searchParams.get("topics");
    if (topics) {
      filters.topics = topics.split(",").map((t) => t.trim());
    }

    const participants = searchParams.get("participants");
    if (participants) {
      filters.participants = participants.split(",").map((p) => p.trim());
    }

    const from = searchParams.get("from");
    if (from) {
      filters.from = new Date(from);
    }

    const to = searchParams.get("to");
    if (to) {
      filters.to = new Date(to);
    }

    const search = searchParams.get("search");
    if (search) {
      filters.search = search;
    }

    const videoId = searchParams.get("videoId");
    if (videoId) {
      filters.videoId = videoId;
    }

    // Fetch decisions using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.getDecisions(organizationId, filters, page, limit);
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
// POST /api/decisions - Create a new decision
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const {
      organizationId,
      summary,
      context,
      source,
      videoId,
      videoTimestamp,
      status,
      decidedAt,
      participantIds,
      tagIds,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "organizationId", message: "Organization ID is required" }),
      );
    }

    if (!summary) {
      return yield* Effect.fail(new MissingFieldError({ field: "summary", message: "Summary is required" }));
    }

    // Create decision using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.createDecision({
      organizationId,
      summary,
      context,
      source,
      videoId,
      videoTimestamp,
      status,
      decidedAt: decidedAt ? new Date(decidedAt) : undefined,
      createdById: user.id,
      participantIds,
      tagIds,
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
