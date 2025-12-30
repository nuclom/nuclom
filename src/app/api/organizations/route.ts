import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { auth } from "@/lib/auth";
import { AppLive, MissingFieldError, OrganizationRepository } from "@/lib/effect";
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
      case "DuplicateError":
        return NextResponse.json({ error: taggedError.message }, { status: 409 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// GET /api/organizations - Get user's organizations
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Fetch organizations using repository
    const orgRepo = yield* OrganizationRepository;
    return yield* orgRepo.getUserOrganizations(user.id);
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
    onSuccess: (data) =>
      NextResponse.json(data, {
        headers: {
          // Organizations change less frequently, use medium cache
          "Cache-Control": getCacheControlHeader(CachePresets.mediumWithSwr()),
        },
      }),
  });
}

// =============================================================================
// POST /api/organizations - Create organization
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

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

    const { name, slug, logo } = body;

    // Validate required fields
    if (!name) {
      return yield* Effect.fail(new MissingFieldError({ field: "name", message: "Name is required" }));
    }

    if (!slug) {
      return yield* Effect.fail(new MissingFieldError({ field: "slug", message: "Slug is required" }));
    }

    // Create organization using repository
    const orgRepo = yield* OrganizationRepository;
    return yield* orgRepo.createOrganization({
      name,
      slug,
      logo,
      userId: user.id,
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
