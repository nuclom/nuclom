import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { AppLive, ValidationError } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import { ChannelRepository } from "@/lib/effect/services/channel-repository";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";

// =============================================================================
// GET /api/channels - Get channels for the active organization
// =============================================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(user.id);

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

    const channelRepo = yield* ChannelRepository;
    return yield* channelRepo.getChannels(activeOrg.value.id, page, limit);
  });

  const FullLayer = createFullLayer();
  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/channels - Create a new channel
// =============================================================================

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, description } = body;

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Channel name is required",
        }),
      );
    }

    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(activeOrg)) {
      return yield* Effect.fail(
        new ValidationError({
          message: "No active organization found",
        }),
      );
    }

    const channelRepo = yield* ChannelRepository;
    const newChannel = yield* channelRepo.createChannel({
      name: name.trim(),
      description: description?.trim(),
      organizationId: activeOrg.value.id,
    });

    return newChannel;
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
