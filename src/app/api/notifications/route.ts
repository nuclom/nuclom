import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createFullLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { NotificationRepository } from "@/lib/effect";
import { Auth } from "@/lib/effect/services/auth";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// GET /api/notifications - Get user's notifications
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Fetch notifications
    const notificationRepo = yield* NotificationRepository;
    return yield* notificationRepo.getNotifications(user.id, page, limit);
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
// POST /api/notifications - Mark all as read
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Mark all as read
    const notificationRepo = yield* NotificationRepository;
    const count = yield* notificationRepo.markAllAsRead(user.id);

    return { markedAsRead: count };
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
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
