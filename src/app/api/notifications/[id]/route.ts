import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, NotificationRepository } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
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
// PATCH /api/notifications/[id] - Mark notification as read
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Mark as read
    const notificationRepo = yield* NotificationRepository;
    return yield* notificationRepo.markAsRead(id, user.id);
  });

  const runnable = Effect.provide(effect, FullLayer);
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
// DELETE /api/notifications/[id] - Delete a notification
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete notification
    const notificationRepo = yield* NotificationRepository;
    yield* notificationRepo.deleteNotification(id, user.id);

    return { message: "Notification deleted successfully", id };
  });

  const runnable = Effect.provide(effect, FullLayer);
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
