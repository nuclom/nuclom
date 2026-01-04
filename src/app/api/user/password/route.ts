/**
 * Password Change API
 *
 * POST /api/user/password - Change password and revoke other sessions
 */

import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import type { NextRequest } from "next/server";
import { createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Auth } from "@/lib/effect/services/auth";
import { rateLimitSensitiveAsync } from "@/lib/rate-limit";
import { revokeSessionsBeforeDate } from "@/lib/session-security";

// =============================================================================
// Validation Schema using Effect Schema
// =============================================================================

const SessionRevocationSchema = Schema.Struct({
  revokeOtherSessions: Schema.optionalWith(Schema.Boolean, { default: () => true }),
});

// =============================================================================
// POST /api/user/password - Change password
// =============================================================================

export async function POST(request: NextRequest) {
  // Apply strict rate limiting for password changes (disabled if Redis not configured)
  const rateLimitResult = await rateLimitSensitiveAsync(request);
  if (rateLimitResult) return rateLimitResult;

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session } = yield* authService.getSession(request.headers);

    // Parse and validate request body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new Error("Invalid request body"),
    });

    const validatedData = yield* Schema.decodeUnknown(SessionRevocationSchema)(body).pipe(
      Effect.mapError((error) => new Error(`Validation failed: ${error.message}`)),
    );

    const { revokeOtherSessions } = validatedData;
    // Note: currentPassword and newPassword validation happens on client-side
    // The actual password change is handled by Better Auth's /api/auth/change-password endpoint
    // This endpoint specifically handles the session revocation part

    // Update password changed timestamp FIRST
    const passwordChangedAt = new Date();

    yield* Effect.tryPromise({
      try: () =>
        db
          .update(users)
          .set({
            passwordChangedAt,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id)),
      catch: (error) => new Error(`Failed to update password timestamp: ${error}`),
    });

    // Revoke sessions created before password change (if requested)
    if (revokeOtherSessions) {
      yield* Effect.tryPromise({
        try: () => revokeSessionsBeforeDate(user.id, passwordChangedAt, session.id),
        catch: (error) => new Error(`Failed to revoke sessions: ${error}`),
      });

      console.log(
        `[Session Security] User ${user.id} changed password - revoked sessions created before ${passwordChangedAt.toISOString()}`,
      );
    }

    // Note: The actual password change should be done via Better Auth's change-password endpoint
    // This endpoint handles the session revocation and timestamp tracking
    return {
      message: "Password change timestamp updated. Complete password change via /api/auth/change-password",
      passwordChangedAt: passwordChangedAt.toISOString(),
      sessionsRevoked: revokeOtherSessions,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
