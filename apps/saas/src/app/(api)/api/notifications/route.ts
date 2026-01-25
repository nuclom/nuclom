import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { NotificationRepository } from '@nuclom/lib/effect/services/notification-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Fetch notifications
    const notificationRepo = yield* NotificationRepository;
    return yield* notificationRepo.getNotifications(user.id, page, limit);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
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

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
