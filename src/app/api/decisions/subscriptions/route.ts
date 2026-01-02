import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, handleEffectExit, mapErrorToApiResponse } from "@/lib/api-handler";
import { MissingFieldError, ValidationError } from "@/lib/effect";
import { DecisionRepository } from "@/lib/effect/services/decision-repository";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// GET /api/decisions/subscriptions - Get user's subscription for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "organizationId",
          message: "Organization ID is required",
        }),
      );
    }

    // Fetch subscription using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.getSubscription(user.id, organizationId);
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
    onSuccess: (data) => NextResponse.json(data ?? { topics: [], frequency: null }),
  });
}

// =============================================================================
// POST /api/decisions/subscriptions - Create or update a subscription
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

    const { organizationId, topics, frequency } = body;

    // Validate required fields
    if (!organizationId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "organizationId", message: "Organization ID is required" }),
      );
    }

    if (!topics || !Array.isArray(topics)) {
      return yield* Effect.fail(
        new ValidationError({ message: "Topics must be an array of strings", field: "topics" }),
      );
    }

    // Validate frequency if provided
    if (frequency && frequency !== "immediate" && frequency !== "daily" && frequency !== "weekly") {
      return yield* Effect.fail(
        new ValidationError({
          message: "Frequency must be 'immediate', 'daily', or 'weekly'",
          field: "frequency",
        }),
      );
    }

    // Create or update subscription using repository
    const decisionRepo = yield* DecisionRepository;
    return yield* decisionRepo.getOrCreateSubscription(user.id, organizationId, topics, frequency);
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
