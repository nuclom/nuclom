import { Effect, Option } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, handleEffectExit } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { VideoRepository } from "@/lib/effect";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import type { ApiResponse } from "@/lib/types";

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
      const response: ApiResponse = {
        success: true,
        data: {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
      };
      return response;
    }

    const videoRepo = yield* VideoRepository;
    const deletedVideos = yield* videoRepo.getDeletedVideos(activeOrg.value.id, page, limit);

    const response: ApiResponse = {
      success: true,
      data: deletedVideos,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
