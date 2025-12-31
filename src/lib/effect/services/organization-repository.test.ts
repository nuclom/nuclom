import { describe, expect, it } from "vitest";
import type {
  CreateOrganizationInput,
  OrganizationRepositoryService,
  OrganizationWithRole,
} from "./organization-repository";

describe("OrganizationRepository Types", () => {
  describe("CreateOrganizationInput", () => {
    it("should have required fields", () => {
      const input: CreateOrganizationInput = {
        name: "Test Organization",
        slug: "test-org",
        userId: "user-123",
      };

      expect(input.name).toBe("Test Organization");
      expect(input.slug).toBe("test-org");
      expect(input.userId).toBe("user-123");
    });

    it("should support optional logo", () => {
      const input: CreateOrganizationInput = {
        name: "Test Organization",
        slug: "test-org",
        userId: "user-123",
        logo: "/logo.png",
      };

      expect(input.logo).toBe("/logo.png");
    });
  });

  describe("OrganizationWithRole", () => {
    it("should include role information", () => {
      const org: OrganizationWithRole = {
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        logo: null,
        createdAt: new Date(),
        role: "owner",
      };

      expect(org.role).toBe("owner");
    });

    it("should support member role", () => {
      const org: OrganizationWithRole = {
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        logo: "/logo.png",
        createdAt: new Date(),
        role: "member",
      };

      expect(org.role).toBe("member");
    });
  });

  describe("OrganizationRepositoryService interface", () => {
    it("should define all required methods", () => {
      // This test verifies the interface structure at compile time
      const mockService: OrganizationRepositoryService = {
        createOrganization: () => {
          throw new Error("Mock");
        },
        getUserOrganizations: () => {
          throw new Error("Mock");
        },
        getActiveOrganization: () => {
          throw new Error("Mock");
        },
        getOrganization: () => {
          throw new Error("Mock");
        },
        getOrganizationBySlug: () => {
          throw new Error("Mock");
        },
        isMember: () => {
          throw new Error("Mock");
        },
        getUserRole: () => {
          throw new Error("Mock");
        },
      };

      expect(mockService.createOrganization).toBeDefined();
      expect(mockService.getUserOrganizations).toBeDefined();
      expect(mockService.getActiveOrganization).toBeDefined();
      expect(mockService.getOrganization).toBeDefined();
      expect(mockService.getOrganizationBySlug).toBeDefined();
      expect(mockService.isMember).toBeDefined();
      expect(mockService.getUserRole).toBeDefined();
    });
  });
});
