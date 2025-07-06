import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock the auth module
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock the organizations API
vi.mock("@/lib/api/organizations", () => ({
  getUserOrganizations: vi.fn(),
  createOrganization: vi.fn(),
}));

describe("/api/organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/organizations", () => {
    it("should return 401 when user is not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/organizations");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return user organizations when authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      const { getUserOrganizations } = await import("@/lib/api/organizations");

      const mockOrganizations = [
        {
          id: "org-1",
          name: "Test Org 1",
          slug: "test-org-1",
          logo: null,
          createdAt: new Date(),
          role: "owner" as const,
        },
        {
          id: "org-2",
          name: "Test Org 2",
          slug: "test-org-2",
          logo: null,
          createdAt: new Date(),
          role: "member" as const,
        },
      ];

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(getUserOrganizations).mockResolvedValue(mockOrganizations);

      const request = new NextRequest("http://localhost:3000/api/organizations");
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getUserOrganizations).toHaveBeenCalledWith("user-1");

      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: "org-1",
        name: "Test Org 1",
        slug: "test-org-1",
      });
      expect(data[1]).toMatchObject({
        id: "org-2",
        name: "Test Org 2",
        slug: "test-org-2",
      });
    });

    it("should handle errors gracefully", async () => {
      const { auth } = await import("@/lib/auth");
      const { getUserOrganizations } = await import("@/lib/api/organizations");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(getUserOrganizations).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/organizations");
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("POST /api/organizations", () => {
    it("should return 401 when user is not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when required fields are missing", async () => {
      const { auth } = await import("@/lib/auth");
      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          // Missing slug
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Name and slug are required");
    });

    it("should create organization successfully with valid data", async () => {
      const { auth } = await import("@/lib/auth");
      const { createOrganization } = await import("@/lib/api/organizations");

      const mockOrganization = {
        id: "org-1",
        name: "Test Organization",
        slug: "test-org",
        logo: "/logo.png",
        createdAt: new Date(),
        metadata: null,
      };

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(createOrganization).mockResolvedValue(mockOrganization);

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
          logo: "/logo.png",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(createOrganization).toHaveBeenCalledWith({
        name: "Test Organization",
        slug: "test-org",
        logo: "/logo.png",
        userId: "user-1",
      });

      const data = await response.json();
      expect(data).toMatchObject({
        id: mockOrganization.id,
        name: mockOrganization.name,
        slug: mockOrganization.slug,
        logo: mockOrganization.logo,
      });
    });

    it("should create organization without logo", async () => {
      const { auth } = await import("@/lib/auth");
      const { createOrganization } = await import("@/lib/api/organizations");

      const mockOrganization = {
        id: "org-1",
        name: "Test Organization",
        slug: "test-org",
        logo: null,
        createdAt: new Date(),
        metadata: null,
      };

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(createOrganization).mockResolvedValue(mockOrganization);

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(createOrganization).toHaveBeenCalledWith({
        name: "Test Organization",
        slug: "test-org",
        logo: undefined,
        userId: "user-1",
      });
    });

    it("should handle errors gracefully", async () => {
      const { auth } = await import("@/lib/auth");
      const { createOrganization } = await import("@/lib/api/organizations");

      auth.api.getSession = vi.fn().mockResolvedValue({ user: { id: "user-1" } });
      vi.mocked(createOrganization).mockRejectedValue(new Error("Database error"));

      const request = new NextRequest("http://localhost:3000/api/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Organization",
          slug: "test-org",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });
});
