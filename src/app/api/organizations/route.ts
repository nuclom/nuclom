import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { MissingFieldError, OrganizationRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// GET /api/organizations - Get user's organizations
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    return yield* orgRepo.getUserOrganizations(user.id);
  });

  const FullLayer = createFullLayer();
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit, {
    cache: { maxAge: 60, staleWhileRevalidate: 120 },
  });
}

// =============================================================================
// POST /api/organizations - Create organization
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    const { name, slug, logo } = body;

    if (!name) {
      return yield* Effect.fail(new MissingFieldError({ field: "name", message: "Name is required" }));
    }

    if (!slug) {
      return yield* Effect.fail(new MissingFieldError({ field: "slug", message: "Slug is required" }));
    }

    const orgRepo = yield* OrganizationRepository;
    return yield* orgRepo.createOrganization({
      name,
      slug,
      logo,
      userId: user.id,
    });
  });

  const FullLayer = createFullLayer();
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
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}
