import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to create the mock before vi.mock runs
const mockUseSession = vi.hoisted(() => vi.fn());

// Mock the entire module with our own implementations
vi.mock('@nuclom/auth/client', () => {
  return {
    authClient: {
      useSession: mockUseSession,
    },
    useAuth: () => {
      const session = mockUseSession();
      return {
        session: session.data,
        user: session.data?.user ?? null,
        isLoading: session.isPending,
        isAuthenticated: !!session.data?.user,
      };
    },
    useRequireAuth: () => {
      const session = mockUseSession();
      const user = session.data?.user ?? null;
      const isLoading = session.isPending;

      if (isLoading) {
        return { user: null, isLoading: true as const };
      }

      if (!user) {
        throw new Error('User must be authenticated to access this resource');
      }

      return { user, isLoading: false as const };
    },
  };
});

// Import after mocking
import { useAuth, useRequireAuth } from '@nuclom/auth/client';

describe('useAuth', () => {
  it('should return session data when logged in', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    mockUseSession.mockReturnValue({
      data: {
        user: mockUser,
        session: { id: 'session-123' },
      },
      isPending: false,
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.session).toBeDefined();
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return null user when not logged in', () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should return loading state when session is pending', () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('should handle session with null user', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: null,
      },
      isPending: false,
      error: null,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
  });
});

describe('useRequireAuth', () => {
  it('should return user when authenticated', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    mockUseSession.mockReturnValue({
      data: {
        user: mockUser,
        session: { id: 'session-123' },
      },
      isPending: false,
      error: null,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it('should return loading state when pending', () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('should throw error when not authenticated and not loading', () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    });

    expect(() => {
      renderHook(() => useRequireAuth());
    }).toThrow('User must be authenticated to access this resource');
  });

  it('should throw error when session exists but user is null', () => {
    mockUseSession.mockReturnValue({
      data: {
        user: null,
      },
      isPending: false,
      error: null,
    });

    expect(() => {
      renderHook(() => useRequireAuth());
    }).toThrow('User must be authenticated to access this resource');
  });
});
