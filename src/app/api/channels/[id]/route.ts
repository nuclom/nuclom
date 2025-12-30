import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, ForbiddenError } from "@/lib/effect";
import { ChannelRepository } from "@/lib/effect/services/channel-repository";
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
// GET /api/channels/[id] - Get channel details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    const channel = yield* channelRepo.getChannel(resolvedParams.id);

    // Verify user has access to this channel's organization
    const isMemberResult = yield* orgRepo.isMember(session.user.id, channel.organizationId);
    if (!isMemberResult) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: "Access denied",
          resource: "Channel",
        }),
      );
    }

    return channel;
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

// =============================================================================
// PATCH /api/channels/[id] - Update channel
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description } = body;

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get channel to verify access
    const channel = yield* channelRepo.getChannel(resolvedParams.id);

    // Verify user has access to this channel's organization
    const isMemberResult = yield* orgRepo.isMember(session.user.id, channel.organizationId);
    if (!isMemberResult) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: "Access denied",
          resource: "Channel",
        }),
      );
    }

    const updateData: { name?: string; description?: string | null } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() ?? null;

    const updatedChannel = yield* channelRepo.updateChannel(resolvedParams.id, updateData);
    return updatedChannel;
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

// =============================================================================
// DELETE /api/channels/[id] - Delete channel
// =============================================================================

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get channel to verify access
    const channel = yield* channelRepo.getChannel(resolvedParams.id);

    // Verify user is an owner of this channel's organization
    const userRole = yield* orgRepo.getUserRole(session.user.id, channel.organizationId);
    if (Option.isNone(userRole) || userRole.value !== "owner") {
      return yield* Effect.fail(
        new ForbiddenError({
          message: "Only organization owners can delete channels",
          resource: "Channel",
        }),
      );
    }

    yield* channelRepo.deleteChannel(resolvedParams.id);
    return { message: "Channel deleted successfully" };
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
