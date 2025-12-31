import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockOrganization } from "@/test/mocks";

// Mock Effect-TS and services
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/effect", () => ({
  AppLive: {},
  MissingFieldError: class MissingFieldError extends Error {
    _tag = "MissingFieldError";
    field: string;
    constructor({ field, message }: { field: string; message: string }) {
      super(message);
      this.field = field;
    }
  },
  OrganizationRepository: {
    _tag: "OrganizationRepository",
  },
}));

vi.mock("@/lib/effect/services/auth", () => ({
  Auth: {
    _tag: "Auth",
  },
  makeAuthLayer: vi.fn().mockReturnValue({}),
}));

vi.mock("effect", () => {
  return {
    Effect: {
      gen: vi.fn((fn) => ({
        _fn: fn,
      })),
      tryPromise: vi.fn(({ try: tryFn }) => tryFn()),
      fail: vi.fn((error) => ({ _tag: "Fail", error })),
      provide: vi.fn((effect, _layer) => effect),
      runPromiseExit: vi.fn(),
    },
    Exit: {
      match: vi.fn((exit, { onSuccess, onFailure }) => {
        if (exit._tag === "Success") {
          return onSuccess(exit.value);
        }
        return onFailure(exit.cause);
      }),
    },
    Cause: {
      failureOption: vi.fn((cause) => cause),
    },
    Layer: {
      merge: vi.fn((_a, _b) => ({})),
    },
  };
});

import { Cause, Effect, Exit } from "effect";
import { GET, POST } from "./route";

describe("Organizations API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/organizations", () => {
    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Failure",
        cause: {
          _tag: "Some",
          value: {
            _tag: "UnauthorizedError",
            message: "Unauthorized",
          },
        },
      });

      vi.mocked(Cause.failureOption).mockReturnValueOnce({
        _tag: "Some",
        value: {
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return user organizations on success", async () => {
      const mockOrgs = [
        { ...createMockOrganization(), role: "owner" },
        { ...createMockOrganization({ id: "org-456", name: "Second Org" }), role: "member" },
      ];

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Success",
        value: mockOrgs,
      });

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess(mockOrgs));

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].role).toBe("owner");
    });

    it("should return empty array when user has no organizations", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Success",
        value: [],
      });

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess([]));

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe("POST /api/organizations", () => {
    it("should return 400 when name is missing", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Failure",
        cause: {
          _tag: "Some",
          value: {
            _tag: "MissingFieldError",
            message: "Name is required",
          },
        },
      });

      vi.mocked(Cause.failureOption).mockReturnValueOnce({
        _tag: "Some",
        value: {
          _tag: "MissingFieldError",
          message: "Name is required",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          slug: "test-org",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("should return 400 when slug is missing", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Failure",
        cause: {
          _tag: "Some",
          value: {
            _tag: "MissingFieldError",
            message: "Slug is required",
          },
        },
      });

      vi.mocked(Cause.failureOption).mockReturnValueOnce({
        _tag: "Some",
        value: {
          _tag: "MissingFieldError",
          message: "Slug is required",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Slug is required");
    });

    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Failure",
        cause: {
          _tag: "Some",
          value: {
            _tag: "UnauthorizedError",
            message: "Unauthorized",
          },
        },
      });

      vi.mocked(Cause.failureOption).mockReturnValueOnce({
        _tag: "Some",
        value: {
          _tag: "UnauthorizedError",
          message: "Unauthorized",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 409 when slug already exists", async () => {
      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Failure",
        cause: {
          _tag: "Some",
          value: {
            _tag: "DuplicateError",
            message: "Organization with this slug already exists",
          },
        },
      });

      vi.mocked(Cause.failureOption).mockReturnValueOnce({
        _tag: "Some",
        value: {
          _tag: "DuplicateError",
          message: "Organization with this slug already exists",
        },
      });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "existing-slug",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("Organization with this slug already exists");
    });

    it("should create organization and return 201 on success", async () => {
      const newOrg = createMockOrganization();

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Success",
        value: newOrg,
      });

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess(newOrg));

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("org-123");
      expect(data.name).toBe("Test Organization");
    });

    it("should create organization with logo", async () => {
      const newOrg = createMockOrganization({ logo: "/custom-logo.png" });

      vi.mocked(Effect.runPromiseExit).mockResolvedValueOnce({
        _tag: "Success",
        value: newOrg,
      });

      vi.mocked(Exit.match).mockImplementationOnce((_exit, { onSuccess }) => onSuccess(newOrg));

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
          logo: "/custom-logo.png",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.logo).toBe("/custom-logo.png");
    });
  });
});
