import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, ValidationError, VideoRepository } from "@/lib/effect";
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
      case "ForbiddenError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 403 });
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
// GET /api/videos/search - Search videos
// =============================================================================

/**
 * GET /api/videos/search
 *
 * Search videos with full-text search and filters.
 *
 * Query parameters:
 * - q: Search query (required)
 * - channelId: Filter by channel
 * - authorId: Filter by author
 * - dateFrom: Filter by start date (ISO 8601)
 * - dateTo: Filter by end date (ISO 8601)
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const channelId = url.searchParams.get("channelId") || undefined;
  const authorId = url.searchParams.get("authorId") || undefined;
  const dateFromStr = url.searchParams.get("dateFrom");
  const dateToStr = url.searchParams.get("dateTo");
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Search query (q) is required" }, { status: 400 });
  }

  const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
  const dateTo = dateToStr ? new Date(dateToStr) : undefined;

  const effect = Effect.gen(function* () {
    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(session.user.id);

    if (Option.isNone(activeOrg)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "No active organization found",
        }),
      );
    }

    const videoRepo = yield* VideoRepository;
    return yield* videoRepo.searchVideos({
      query: query.trim(),
      organizationId: activeOrg.value.id,
      channelId,
      authorId,
      dateFrom,
      dateTo,
      page,
      limit,
    });
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
