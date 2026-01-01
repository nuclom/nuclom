import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuth, useRequireAuth } from "./use-auth";

// Mock the auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

// Import the mocked module
import { authClient } from "@/lib/auth-client";

describe("useAuth", () => {
  it("should return session data when logged in", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    };

    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: mockUser,
        session: { id: "session-123" },
      },
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useAuth());

    expect(result.current.session).toBeDefined();
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it("should return null user when not logged in", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useAuth());

    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should return loading state when session is pending", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("should handle session with null user", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: null,
      },
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
  });
});

describe("useRequireAuth", () => {
  it("should return user when authenticated", () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      name: "Test User",
    };

    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: mockUser,
        session: { id: "session-123" },
      },
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isLoading).toBe(false);
  });

  it("should return loading state when pending", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("should throw error when not authenticated and not loading", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    expect(() => {
      renderHook(() => useRequireAuth());
    }).toThrow("User must be authenticated to access this resource");
  });

  it("should throw error when session exists but user is null", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: null,
      },
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof authClient.useSession>);

    expect(() => {
      renderHook(() => useRequireAuth());
    }).toThrow("User must be authenticated to access this resource");
  });
});
