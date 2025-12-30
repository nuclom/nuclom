/**
 * Auth Service using Effect-TS
 *
 * Provides Effect wrappers around Better-Auth for type-safe authentication.
 */

import { Effect, Context, Layer, Option, pipe } from "effect";
import type { Session, User } from "better-auth";
import { UnauthorizedError, SessionError, ForbiddenError, type AuthError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface UserSession {
  readonly session: Session;
  readonly user: User;
}

export interface AuthServiceInterface {
  /**
   * Get the current session from headers
   */
  readonly getSession: (headers: Headers) => Effect.Effect<UserSession, UnauthorizedError>;

  /**
   * Get the current session, returning None if not authenticated
   */
  readonly getSessionOption: (headers: Headers) => Effect.Effect<Option.Option<UserSession>, never>;

  /**
   * Require authentication, returning the session or failing
   */
  readonly requireAuth: (headers: Headers) => Effect.Effect<UserSession, UnauthorizedError>;

  /**
   * Check if user has specific role
   */
  readonly requireRole: (
    headers: Headers,
    role: string | string[],
  ) => Effect.Effect<UserSession, UnauthorizedError | ForbiddenError>;

  /**
   * Check if user is admin
   */
  readonly requireAdmin: (headers: Headers) => Effect.Effect<UserSession, UnauthorizedError | ForbiddenError>;
}

// =============================================================================
// Auth Service Tag
// =============================================================================

export class Auth extends Context.Tag("Auth")<Auth, AuthServiceInterface>() {}

// =============================================================================
// Auth Instance Type (for dependency injection)
// =============================================================================

type AuthInstance = {
  api: {
    getSession: (options: { headers: Headers }) => Promise<{ session: Session; user: User } | null>;
  };
};

// =============================================================================
// Auth Service Implementation Factory
// =============================================================================

/**
 * Creates an Auth service implementation using the provided auth instance
 */
export const makeAuthService = (authInstance: AuthInstance) =>
  Effect.sync(() => {
    const getSession = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError> =>
      Effect.tryPromise({
        try: async () => {
          const result = await authInstance.api.getSession({ headers });
          if (!result) {
            throw new Error("No session");
          }
          return result;
        },
        catch: () => UnauthorizedError.default,
      });

    const getSessionOption = (headers: Headers): Effect.Effect<Option.Option<UserSession>, never> =>
      pipe(
        getSession(headers),
        Effect.map(Option.some),
        Effect.catchAll(() => Effect.succeed(Option.none())),
      );

    const requireAuth = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError> => getSession(headers);

    const requireRole = (
      headers: Headers,
      role: string | string[],
    ): Effect.Effect<UserSession, UnauthorizedError | ForbiddenError> =>
      pipe(
        getSession(headers),
        Effect.flatMap((session) => {
          const roles = Array.isArray(role) ? role : [role];
          const userRole = (session.user as any).role;

          if (!roles.includes(userRole)) {
            return Effect.fail(
              new ForbiddenError({
                message: `Required role: ${roles.join(" or ")}`,
                resource: "auth",
              }),
            );
          }

          return Effect.succeed(session);
        }),
      );

    const requireAdmin = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError | ForbiddenError> =>
      requireRole(headers, "admin");

    return {
      getSession,
      getSessionOption,
      requireAuth,
      requireRole,
      requireAdmin,
    } satisfies AuthServiceInterface;
  });

// =============================================================================
// Auth Layer Factory
// =============================================================================

/**
 * Creates an Auth layer using the provided auth instance
 */
export const makeAuthLayer = (authInstance: AuthInstance) => Layer.effect(Auth, makeAuthService(authInstance));

// =============================================================================
// Auth Helper Functions
// =============================================================================

/**
 * Get the current session
 */
export const getSession = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError, Auth> =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.getSession(headers);
  });

/**
 * Get the current session as Option
 */
export const getSessionOption = (headers: Headers): Effect.Effect<Option.Option<UserSession>, never, Auth> =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.getSessionOption(headers);
  });

/**
 * Require authentication
 */
export const requireAuth = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError, Auth> =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.requireAuth(headers);
  });

/**
 * Require specific role
 */
export const requireRole = (
  headers: Headers,
  role: string | string[],
): Effect.Effect<UserSession, UnauthorizedError | ForbiddenError, Auth> =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.requireRole(headers, role);
  });

/**
 * Require admin role
 */
export const requireAdmin = (headers: Headers): Effect.Effect<UserSession, UnauthorizedError | ForbiddenError, Auth> =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    return yield* auth.requireAdmin(headers);
  });
