/**
 * Individual Session API
 *
 * DELETE /api/user/sessions/:sessionId - Revoke a specific session
 */

import { eq } from "drizzle-orm";
import { Effect } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { Auth } from "@/lib/effect/services/auth";

// =============================================================================
// DELETE /api/user/sessions/:sessionId - Revoke a specific session
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session: currentSession } = yield* authService.getSession(request.headers);

    // Prevent revoking the current session through this endpoint
    if (sessionId === currentSession.id) {
      return yield* Effect.fail(
        new Error("Cannot revoke current session through this endpoint. Use /api/auth/sign-out instead."),
      );
    }

    // Verify the session belongs to this user
    const targetSession = yield* Effect.tryPromise({
      try: async () => {
        return db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
          columns: { id: true, userId: true },
        });
      },
      catch: (error) => new Error(`Failed to find session: ${error}`),
    });

    if (!targetSession) {
      return yield* Effect.fail(new Error("Session not found"));
    }

    if (targetSession.userId !== user.id) {
      return yield* Effect.fail(new Error("Session not found")); // Don't reveal existence of other users' sessions
    }

    // Delete the session
    yield* Effect.tryPromise({
      try: () => db.delete(sessions).where(eq(sessions.id, sessionId)),
      catch: (error) => new Error(`Failed to revoke session: ${error}`),
    });

    console.log(`[Session Security] User ${user.id} revoked session ${sessionId}`);

    return {
      message: "Session revoked successfully",
      sessionId,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
