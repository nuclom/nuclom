/**
 * User Sessions API
 *
 * GET /api/user/sessions - List all active sessions for the current user
 * DELETE /api/user/sessions - Revoke all sessions except current
 */

import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { mapErrorToApiResponse } from "@/lib/api-errors";
import { auth } from "@/lib/auth";
import { AppLive } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { getUserActiveSessions, revokeUserSessions } from "@/lib/session-security";

// =============================================================================
// GET /api/user/sessions - List active sessions
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session } = yield* authService.getSession(request.headers);

    // Get all active sessions for this user
    const activeSessions = yield* Effect.tryPromise({
      try: () => getUserActiveSessions(user.id),
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
    onSuccess: (data) => NextResponse.json(data),
  });
}

// =============================================================================
// DELETE /api/user/sessions - Revoke all other sessions
// =============================================================================

export async function DELETE(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user, session } = yield* authService.getSession(request.headers);

    // Revoke all sessions except the current one
    const result = yield* Effect.tryPromise({
      try: () => revokeUserSessions(user.id, session.id),
      catch: (error) => new Error(`Failed to revoke sessions: ${error}`),
    });

    console.log(`[Session Security] User ${user.id} revoked all other sessions`);

    return {
      message: "All other sessions have been revoked",
      revokedCount: result.revokedCount,
    };
  });

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
    onSuccess: (data) => NextResponse.json(data),
  });
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
    return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  }

  // Simple user agent parsing
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  // Detect browser
  if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    browser = "Chrome";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  } else if (userAgent.includes("Edg")) {
    browser = "Edge";
  }

  // Detect OS
  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    os = "macOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
    device = "Mobile";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
    device = userAgent.includes("iPad") ? "Tablet" : "Mobile";
  }

  return { browser, os, device };
}
