/**
 * Auth Service Tests
 *
 * Tests the Auth service using Effect-TS patterns with mocked auth instance.
 */

import { Effect, Exit, Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth, makeAuthLayer, type UserSession } from './auth';

describe('Auth Service', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
  } as const;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    token: 'test-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  } as const;

  const mockUserSession = {
    user: mockUser,
    session: mockSession,
  } as unknown as UserSession;

  let mockAuthInstance: {
    api: {
      getSession: ReturnType<typeof vi.fn<(options: { headers: Headers }) => Promise<UserSession | null>>>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthInstance = {
      api: {
        getSession: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createTestLayer = () => makeAuthLayer(mockAuthInstance);

  describe('getSession', () => {
    it('should return session when authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSession(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.user.id).toBe('user-123');
      expect(result.session.id).toBe('session-123');
    });

    it('should fail with UnauthorizedError when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSession(new Headers());
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should fail when session API throws', async () => {
      mockAuthInstance.api.getSession.mockRejectedValueOnce(new Error('API error'));
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSession(new Headers());
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should pass headers to auth instance', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const headers = new Headers({
        cookie: 'session=abc123',
        authorization: 'Bearer token',
      });

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSession(headers);
      });

      await Effect.runPromise(Effect.provide(program, testLayer));

      expect(mockAuthInstance.api.getSession).toHaveBeenCalledWith({ headers });
    });
  });

  describe('getSessionOption', () => {
    it('should return Some when authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSessionOption(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value.user.id).toBe('user-123');
      }
    });

    it('should return None when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSessionOption(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(Option.isNone(result)).toBe(true);
    });

    it('should return None when session API throws', async () => {
      mockAuthInstance.api.getSession.mockRejectedValueOnce(new Error('API error'));
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.getSessionOption(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(Option.isNone(result)).toBe(true);
    });
  });

  describe('requireAuth', () => {
    it('should return session when authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireAuth(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.user.id).toBe('user-123');
    });

    it('should fail with UnauthorizedError when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireAuth(new Headers());
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('requireRole', () => {
    it('should succeed when user has required role', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      const adminSession = { ...mockUserSession, user: adminUser };
      mockAuthInstance.api.getSession.mockResolvedValueOnce(adminSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireRole(new Headers(), 'admin');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect((result.user as unknown as { role: string }).role).toBe('admin');
    });

    it('should succeed when user has one of the required roles', async () => {
      const moderatorUser = { ...mockUser, role: 'moderator' };
      const moderatorSession = { ...mockUserSession, user: moderatorUser };
      mockAuthInstance.api.getSession.mockResolvedValueOnce(moderatorSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireRole(new Headers(), ['admin', 'moderator']);
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect((result.user as unknown as { role: string }).role).toBe('moderator');
    });

    it('should fail with ForbiddenError when user lacks required role', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireRole(new Headers(), 'admin');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should fail with UnauthorizedError when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireRole(new Headers(), 'admin');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should handle user without role property', async () => {
      const userWithoutRole = { ...mockUser, role: undefined };
      const sessionWithoutRole = { ...mockUserSession, user: userWithoutRole };
      mockAuthInstance.api.getSession.mockResolvedValueOnce(sessionWithoutRole);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireRole(new Headers(), 'admin');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('requireAdmin', () => {
    it('should succeed when user is admin', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      const adminSession = { ...mockUserSession, user: adminUser };
      mockAuthInstance.api.getSession.mockResolvedValueOnce(adminSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireAdmin(new Headers());
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect((result.user as unknown as { role: string }).role).toBe('admin');
    });

    it('should fail with ForbiddenError when user is not admin', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(mockUserSession);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireAdmin(new Headers());
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it('should fail with UnauthorizedError when not authenticated', async () => {
      mockAuthInstance.api.getSession.mockResolvedValueOnce(null);
      const testLayer = createTestLayer();

      const program = Effect.gen(function* () {
        const auth = yield* Auth;
        return yield* auth.requireAdmin(new Headers());
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });
});
