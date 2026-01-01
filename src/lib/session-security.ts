/**
 * Session Security Utilities
 *
 * Provides utilities for:
 * - Session fingerprinting (IP + user agent binding)
 * - Session revocation on password change
 * - Concurrent session limits
 * - Secure cookie settings
 */

import process from "node:process";
import { and, count, desc, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "./db";
import { sessions, users } from "./db/schema";

// =============================================================================
// Configuration
// =============================================================================

/** Default maximum concurrent sessions per user */
export const DEFAULT_MAX_SESSIONS = 5;

/** Session fingerprint validation interval (in milliseconds) */
export const FINGERPRINT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

// =============================================================================
// Session Fingerprinting
// =============================================================================

/**
 * Generate a session fingerprint from request metadata
 *
 * The fingerprint is a hash of:
 * - IP address
 * - User agent string
 *
 * This helps detect session hijacking attempts where the session token
 * is used from a different device/location.
 */
export async function generateFingerprint(ipAddress: string | null, userAgent: string | null): Promise<string> {
  const data = `${ipAddress || "unknown"}|${userAgent || "unknown"}`;

  // Use Web Crypto API for hashing (works in both Node.js and Edge runtime)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Validate that the current request fingerprint matches the session fingerprint
 *
 * @returns true if fingerprint is valid or not set, false if mismatch detected
 */
export async function validateSessionFingerprint(
  sessionId: string,
  currentIp: string | null,
  currentUserAgent: string | null,
): Promise<{ valid: boolean; requiresUpdate: boolean }> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    columns: {
      fingerprint: true,
      lastFingerprintCheck: true,
    },
  });

  if (!session) {
    return { valid: false, requiresUpdate: false };
  }

  // If no fingerprint is set, allow but mark for update
  if (!session.fingerprint) {
    return { valid: true, requiresUpdate: true };
  }

  const currentFingerprint = await generateFingerprint(currentIp, currentUserAgent);

  // Check if fingerprints match
  if (session.fingerprint !== currentFingerprint) {
    console.warn(`[Session Security] Fingerprint mismatch for session ${sessionId}`);
    return { valid: false, requiresUpdate: false };
  }

  // Check if we need to update the last check timestamp
  const now = Date.now();
  const lastCheck = session.lastFingerprintCheck?.getTime() || 0;
  const requiresUpdate = now - lastCheck > FINGERPRINT_CHECK_INTERVAL;

  return { valid: true, requiresUpdate };
}

/**
 * Update session fingerprint and last check timestamp
 */
export async function updateSessionFingerprint(
  sessionId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const fingerprint = await generateFingerprint(ipAddress, userAgent);

  await db
    .update(sessions)
    .set({
      fingerprint,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      lastFingerprintCheck: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

// =============================================================================
// Session Revocation
// =============================================================================

/**
 * Revoke all sessions for a user except the current one
 *
 * Used when:
 * - User changes their password
 * - User explicitly logs out of all devices
 * - Account is compromised
 */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<{ revokedCount: number }> {
  if (exceptSessionId) {
    // Delete all sessions except the specified one
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)));
  } else {
    // Delete all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  return { revokedCount: 0 }; // Drizzle doesn't return count easily
}

/**
 * Revoke all sessions for a user (including current)
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Revoke sessions created before a specific date
 *
 * Used for password change - revokes all sessions created before the password was changed
 */
export async function revokeSessionsBeforeDate(
  userId: string,
  beforeDate: Date,
  exceptSessionId?: string,
): Promise<void> {
  if (exceptSessionId) {
    // Delete all sessions created before the date, except the current one
    const allSessions = await db.query.sessions.findMany({
      where: and(eq(sessions.userId, userId), lt(sessions.createdAt, beforeDate)),
      columns: { id: true },
    });

    const sessionIdsToDelete = allSessions.filter((s) => s.id !== exceptSessionId).map((s) => s.id);

    if (sessionIdsToDelete.length > 0) {
      for (const id of sessionIdsToDelete) {
        await db.delete(sessions).where(eq(sessions.id, id));
      }
    }
  } else {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.createdAt, beforeDate)));
  }
}

/**
 * Check if a session was created after the last password change
 *
 * @returns true if session is valid, false if it should be revoked
 */
export async function isSessionValidAfterPasswordChange(sessionId: string, userId: string): Promise<boolean> {
  const [session, user] = await Promise.all([
    db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      columns: { createdAt: true },
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordChangedAt: true },
    }),
  ]);

  if (!session) return false;
  if (!user || !user.passwordChangedAt) return true; // No password change recorded

  // Session is valid if it was created after the password change
  return session.createdAt >= user.passwordChangedAt;
}

// =============================================================================
// Concurrent Session Limits
// =============================================================================

/**
 * Get the maximum allowed sessions for a user
 */
export async function getMaxSessionsForUser(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { maxSessions: true },
  });

  return user?.maxSessions ?? DEFAULT_MAX_SESSIONS;
}

/**
 * Get the current session count for a user
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const result = await db.select({ count: count() }).from(sessions).where(eq(sessions.userId, userId));

  return result[0]?.count ?? 0;
}

/**
 * Enforce concurrent session limit by removing oldest sessions
 *
 * @returns The number of sessions removed
 */
export async function enforceSessionLimit(userId: string, exceptSessionId?: string): Promise<number> {
  const maxSessions = await getMaxSessionsForUser(userId);
  const currentCount = await getUserSessionCount(userId);

  if (currentCount <= maxSessions) {
    return 0;
  }

  // Get all sessions for this user, ordered by creation date (oldest first)
  const userSessions = await db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
    columns: { id: true, createdAt: true },
    orderBy: [sessions.createdAt],
  });

  // Filter out the current session if specified
  const sessionsToConsider = exceptSessionId ? userSessions.filter((s) => s.id !== exceptSessionId) : userSessions;

  // Calculate how many sessions to remove
  const sessionsToRemove = currentCount - maxSessions;
  const sessionIdsToRemove = sessionsToConsider.slice(0, sessionsToRemove).map((s) => s.id);

  // Remove the oldest sessions
  for (const id of sessionIdsToRemove) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  return sessionIdsToRemove.length;
}

/**
 * Get all active sessions for a user (for display in settings)
 */
export async function getUserActiveSessions(userId: string): Promise<
  Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastFingerprintCheck: Date | null;
  }>
> {
  const now = new Date();

  return db.query.sessions.findMany({
    where: and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)),
    columns: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastFingerprintCheck: true,
    },
    orderBy: [desc(sessions.createdAt)],
  });
}

// =============================================================================
// Secure Cookie Settings
// =============================================================================

/**
 * Get secure cookie options based on environment
 */
export function getSecureCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true, // Prevent JavaScript access
    secure: isProduction, // Only send over HTTPS in production
    sameSite: "lax", // Protect against CSRF while allowing navigation
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  };
}

/**
 * Strict cookie options for sensitive operations
 */
export function getStrictCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  maxAge: number;
} {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict", // Strictest CSRF protection
    path: "/",
    maxAge: 60 * 15, // 15 minutes for sensitive operations
  };
}
