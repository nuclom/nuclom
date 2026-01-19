/**
 * User Sessions API
 *
 * GET /api/user/sessions - List all active sessions for the current user
 * DELETE /api/user/sessions - Revoke all sessions except current
 *
 * Uses better-auth's built-in session management via multiSession plugin
 */

import { createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { sessions } from '@nuclom/lib/db/schema';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { and, desc, eq, gt } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/user/sessions - List active sessions
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session } = yield* authService.getSession(request.headers);

    // Get all active sessions for this user using direct DB query
    // better-auth stores ipAddress and userAgent on sessions automatically
    const now = new Date();
    const activeSessions = yield* Effect.tryPromise({
      try: () =>
        db.query.sessions.findMany({
          where: and(eq(sessions.userId, user.id), gt(sessions.expiresAt, now)),
          columns: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
          orderBy: [desc(sessions.createdAt)],
        }),
      catch: (error) => new Error(`Failed to get sessions: ${error}`),
    });

    // Mark current session
    const sessionsWithCurrent = activeSessions.map((s) => ({
      ...s,
      isCurrent: s.id === session.id,
      // Parse user agent for display
      device: parseUserAgent(s.userAgent),
    }));

    return {
      sessions: sessionsWithCurrent,
      currentSessionId: session.id,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/user/sessions - Revoke all other sessions
// =============================================================================

export async function DELETE(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session } = yield* authService.getSession(request.headers);

    // Delete all sessions except the current one
    const revokedCount = yield* Effect.tryPromise({
      try: async () => {
        // Get all session IDs except current
        const otherSessions = await db.query.sessions.findMany({
          where: eq(sessions.userId, user.id),
          columns: { id: true },
        });

        const idsToDelete = otherSessions.filter((s) => s.id !== session.id).map((s) => s.id);

        for (const id of idsToDelete) {
          await db.delete(sessions).where(eq(sessions.id, id));
        }

        return idsToDelete.length;
      },
      catch: (error) => new Error(`Failed to revoke sessions: ${error}`),
    });

    console.log(`[Session] User ${user.id} revoked ${revokedCount} other sessions`);

    return {
      message: 'All other sessions have been revoked',
      revokedCount,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// Helpers
// =============================================================================

function parseUserAgent(userAgent: string | null): {
  browser: string;
  os: string;
  device: string;
} {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  }

  // Simple user agent parsing
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  // Detect browser
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'Mobile';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
    device = userAgent.includes('iPad') ? 'Tablet' : 'Mobile';
  }

  return { browser, os, device };
}
