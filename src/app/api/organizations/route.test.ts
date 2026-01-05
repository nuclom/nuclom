import { Effect, Layer } from "effect";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateError, UnauthorizedError } from "@/lib/effect/errors";
import { Auth, type AuthServiceInterface } from "@/lib/effect/services/auth";
import {
  OrganizationRepository,
  type OrganizationRepositoryService,
} from "@/lib/effect/services/organization-repository";
import { SlackMonitoring, type SlackMonitoringServiceInterface } from "@/lib/effect/services/slack-monitoring";
import { createMockOrganization, createMockSession } from "@/test/mocks";

// Mock the api-handler module to provide test layers
vi.mock("@/lib/api-handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-handler")>();
  return {
    ...actual,
    createFullLayer: vi.fn(),
  };
});

import { createFullLayer } from "@/lib/api-handler";
import { GET, POST } from "./route";

describe("Organizations API Route", () => {
  // Helper to create a mock auth service
  const createMockAuthService = (authenticated = true): AuthServiceInterface => {
    const session = createMockSession();
    return {
      getSession: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      getSessionOption: vi
        .fn()
        .mockImplementation(() =>
          authenticated
            ? Effect.succeed({ _tag: "Some" as const, value: session })
            : Effect.succeed({ _tag: "None" as const }),
        ),
      requireAuth: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      requireRole: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
      requireAdmin: vi
        .fn()
        .mockImplementation(() =>
          authenticated ? Effect.succeed(session) : Effect.fail(new UnauthorizedError({ message: "Unauthorized" })),
        ),
    };
  };

  // Helper to create a mock organization repository
  const createMockOrganizationRepository = (): OrganizationRepositoryService => {
    const mockOrg = createMockOrganization();
    const orgWithRole = { ...mockOrg, role: "owner" as const };

    return {
      createOrganization: vi.fn().mockImplementation((data) => Effect.succeed({ ...mockOrg, ...data })),
      updateOrganization: vi.fn().mockImplementation((id, data) => Effect.succeed({ ...mockOrg, id, ...data })),
      getUserOrganizations: vi.fn().mockImplementation(() => Effect.succeed([orgWithRole])),
      getActiveOrganization: vi
        .fn()
        .mockImplementation(() => Effect.succeed({ _tag: "Some" as const, value: orgWithRole })),
      getOrganization: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
      getOrganizationBySlug: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
      isMember: vi.fn().mockImplementation(() => Effect.succeed(true)),
      getUserRole: vi.fn().mockImplementation(() => Effect.succeed({ _tag: "Some" as const, value: "owner" })),
      getOrganizationMembers: vi.fn().mockImplementation(() => Effect.succeed([])),
      removeMember: vi.fn().mockImplementation(() => Effect.void),
      updateMemberRole: vi.fn().mockImplementation(() => Effect.succeed({})),
    };
  };

  // Helper to create a mock Slack monitoring service
  const createMockSlackMonitoringService = (): SlackMonitoringServiceInterface => ({
    isConfigured: false,
    sendEvent: vi.fn().mockImplementation(() => Effect.void),
    sendAccountEvent: vi.fn().mockImplementation(() => Effect.void),
    sendBillingEvent: vi.fn().mockImplementation(() => Effect.void),
    sendVideoEvent: vi.fn().mockImplementation(() => Effect.void),
    sendErrorEvent: vi.fn().mockImplementation(() => Effect.void),
  });

  // Setup test layer for each test
  const setupTestLayer = (
    options: {
      authenticated?: boolean;
      orgRepo?: Partial<OrganizationRepositoryService>;
      slackMonitoring?: Partial<SlackMonitoringServiceInterface>;
    } = {},
  ) => {
    const { authenticated = true, orgRepo = {}, slackMonitoring = {} } = options;
    const mockAuth = createMockAuthService(authenticated);
    const mockOrgRepo = { ...createMockOrganizationRepository(), ...orgRepo };
    const mockSlack = { ...createMockSlackMonitoringService(), ...slackMonitoring };

    const AuthLayer = Layer.succeed(Auth, mockAuth);
    const OrgRepoLayer = Layer.succeed(OrganizationRepository, mockOrgRepo as OrganizationRepositoryService);
    const SlackLayer = Layer.succeed(SlackMonitoring, mockSlack as SlackMonitoringServiceInterface);
    const testLayer = Layer.mergeAll(AuthLayer, OrgRepoLayer, SlackLayer);

    vi.mocked(createFullLayer).mockReturnValue(testLayer as never);

    return { mockAuth, mockOrgRepo, mockSlack };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("GET /api/organizations", () => {
    it("should return 401 when user is not authenticated", async () => {
      setupTestLayer({ authenticated: false });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.error.message).toBe("Unauthorized");
    });

    it("should return user organizations on success", async () => {
      const { mockOrgRepo } = setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].role).toBe("owner");
      expect(mockOrgRepo.getUserOrganizations).toHaveBeenCalled();
    });

    it("should return empty array when user has no organizations", async () => {
      setupTestLayer({
        orgRepo: {
          getUserOrganizations: vi.fn().mockImplementation(() => Effect.succeed([])),
        },
      });

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
      setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          slug: "test-org",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_MISSING_FIELD");
    });

    it("should return 400 when slug is missing", async () => {
      setupTestLayer();

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_MISSING_FIELD");
    });

    it("should return 401 when user is not authenticated", async () => {
      setupTestLayer({ authenticated: false });

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
      expect(data.error.code).toBe("AUTH_UNAUTHORIZED");
      expect(data.error.message).toBe("Unauthorized");
    });

    it("should return 409 when slug already exists", async () => {
      setupTestLayer({
        orgRepo: {
          createOrganization: vi.fn().mockImplementation(() =>
            Effect.fail(
              new DuplicateError({
                message: "Organization with this slug already exists",
                entity: "organization",
              }),
            ),
          ),
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
      expect(data.error.code).toBe("CONFLICT_DUPLICATE");
      expect(data.error.message).toBe("Organization with this slug already exists");
    });

    it("should create organization and return 201 on success", async () => {
      const { mockOrgRepo, mockSlack } = setupTestLayer();

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
      expect(mockOrgRepo.createOrganization).toHaveBeenCalled();
      expect(mockSlack.sendAccountEvent).toHaveBeenCalledWith("organization_created", expect.any(Object));
    });

    it("should create organization with logo", async () => {
      setupTestLayer({
        orgRepo: {
          createOrganization: vi
            .fn()
            .mockImplementation((data) => Effect.succeed({ ...createMockOrganization(), ...data })),
        },
      });

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
