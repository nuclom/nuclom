import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { NotificationRepository } from '@nuclom/lib/effect/services/notification-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// PATCH /api/notifications/[id] - Mark notification as read
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Mark as read
    const notificationRepo = yield* NotificationRepository;
    return yield* notificationRepo.markAsRead(id, user.id);
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/notifications/[id] - Delete a notification
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Delete notification
    const notificationRepo = yield* NotificationRepository;
    yield* notificationRepo.deleteNotification(id, user.id);

    return { message: 'Notification deleted successfully', id };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
