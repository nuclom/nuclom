import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { CachePresets, getCacheControlHeader, parsePaginationParams } from "@/lib/api-utils";
import { MissingFieldError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
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
    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const topics = searchParams.get("topics");
    const participants = searchParams.get("participants");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = searchParams.get("search");
    const videoId = searchParams.get("videoId");

    const filters: DecisionFilters = {
      ...(status === "decided" || status === "proposed" || status === "superseded" ? { status } : {}),
      ...(source === "meeting" || source === "adhoc" || source === "manual" ? { source } : {}),
      ...(topics ? { topics: topics.split(",").map((t) => t.trim()) } : {}),
      ...(participants ? { participants: participants.split(",").map((p) => p.trim()) } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(search ? { search } : {}),
      ...(videoId ? { videoId } : {}),
    };

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
