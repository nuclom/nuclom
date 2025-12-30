import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, VideoRepository } from "@/lib/effect";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "ValidationError":
      case "MissingFieldError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// GET /api/videos/deleted - Get soft-deleted videos for the organization
// =============================================================================

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  const effect = Effect.gen(function* () {
    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrg)) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.getDeletedVideos(activeOrg.value.id, page, limit);
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
