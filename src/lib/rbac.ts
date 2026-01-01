import { and, eq, isNull, or } from "drizzle-orm";
import { AuditLogger } from "./audit-log";
import { db } from "./db";
import {
  type CustomRole,
  customRoles,
  members,
  type NewCustomRole,
  type NewRolePermission,
  type NewUserRoleAssignment,
  type PermissionAction,
  type PermissionResource,
  type RolePermission,
  resourcePermissions,
  rolePermissions,
  userRoleAssignments,
} from "./db/schema";

export interface PermissionCheck {
  resource: PermissionResource;
  action: PermissionAction;
  resourceId?: string;
  organizationId: string;
  userId: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  grantedBy?: "role" | "resource_permission" | "owner";
}

// Default system role definitions
export const SYSTEM_ROLES = {
  OWNER: {
    name: "Owner",
    description: "Full control over the organization",
    color: "#dc2626",
    permissions: [
      // All resources, all actions
      { resource: "video" as const, actions: ["create", "read", "update", "delete", "share", "download", "manage"] },
      { resource: "channel" as const, actions: ["create", "read", "update", "delete", "manage"] },
      { resource: "collection" as const, actions: ["create", "read", "update", "delete", "share", "manage"] },
      { resource: "comment" as const, actions: ["create", "read", "update", "delete", "comment"] },
      { resource: "member" as const, actions: ["read", "invite", "manage", "admin"] },
      { resource: "settings" as const, actions: ["read", "update", "manage", "admin"] },
      { resource: "billing" as const, actions: ["read", "update", "manage", "admin"] },
      { resource: "analytics" as const, actions: ["read"] },
      { resource: "integration" as const, actions: ["create", "read", "update", "delete", "manage"] },
      { resource: "audit_log" as const, actions: ["read", "download"] },
    ],
  },
  ADMIN: {
    name: "Admin",
    description: "Administrative access except billing",
    color: "#f59e0b",
    permissions: [
      { resource: "video" as const, actions: ["create", "read", "update", "delete", "share", "download", "manage"] },
      { resource: "channel" as const, actions: ["create", "read", "update", "delete", "manage"] },
      { resource: "collection" as const, actions: ["create", "read", "update", "delete", "share", "manage"] },
      { resource: "comment" as const, actions: ["create", "read", "update", "delete", "comment"] },
      { resource: "member" as const, actions: ["read", "invite", "manage"] },
      { resource: "settings" as const, actions: ["read", "update", "manage"] },
      { resource: "billing" as const, actions: ["read"] }, // Read-only billing
      { resource: "analytics" as const, actions: ["read"] },
      { resource: "integration" as const, actions: ["create", "read", "update", "delete", "manage"] },
      { resource: "audit_log" as const, actions: ["read"] },
    ],
  },
  EDITOR: {
    name: "Editor",
    description: "Can create and edit content",
    color: "#3b82f6",
    permissions: [
      { resource: "video" as const, actions: ["create", "read", "update", "share", "download", "comment"] },
      { resource: "channel" as const, actions: ["read"] },
      { resource: "collection" as const, actions: ["create", "read", "update", "share"] },
      { resource: "comment" as const, actions: ["create", "read", "update", "delete", "comment"] },
      { resource: "member" as const, actions: ["read"] },
      { resource: "analytics" as const, actions: ["read"] },
    ],
  },
  VIEWER: {
    name: "Viewer",
    description: "Read-only access",
    color: "#6b7280",
    permissions: [
      { resource: "video" as const, actions: ["read", "comment", "download"] },
      { resource: "channel" as const, actions: ["read"] },
      { resource: "collection" as const, actions: ["read"] },
      { resource: "comment" as const, actions: ["read", "comment"] },
      { resource: "member" as const, actions: ["read"] },
      { resource: "analytics" as const, actions: ["read"] },
    ],
  },
};

/**
 * RBAC Service - Role-Based Access Control for enterprise organizations
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern
export class RBACService {
  /**
   * Check if a user has permission to perform an action on a resource
   */
  static async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    const { resource, action, resourceId, organizationId, userId } = check;

    // First, check if user is organization owner (via members table)
    const membership = await db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.organizationId, organizationId)),
    });

    if (!membership) {
      return { allowed: false, reason: "User is not a member of this organization" };
    }

    // Owners have all permissions
    if (membership.role === "owner") {
      return { allowed: true, grantedBy: "owner" };
    }

    // Check resource-level permissions first (most specific)
    if (resourceId) {
      const resourcePerm = await db.query.resourcePermissions.findFirst({
        where: and(
          eq(resourcePermissions.organizationId, organizationId),
          eq(resourcePermissions.resourceType, resource),
          eq(resourcePermissions.resourceId, resourceId),
          eq(resourcePermissions.action, action),
          or(eq(resourcePermissions.userId, userId), isNull(resourcePermissions.expiresAt)),
        ),
      });

      if (resourcePerm) {
        // Check if not expired
        if (!resourcePerm.expiresAt || resourcePerm.expiresAt > new Date()) {
          return { allowed: true, grantedBy: "resource_permission" };
        }
      }
    }

    // Check role-based permissions
    const userRoles = await db.query.userRoleAssignments.findMany({
      where: and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.organizationId, organizationId)),
      with: {
        role: {
          with: {
            permissions: true,
          },
        },
      },
    });

    for (const assignment of userRoles) {
      for (const perm of assignment.role.permissions) {
        if (perm.resource === resource && perm.action === action) {
          // Check conditions if any
          if (perm.conditions) {
            const conditions = perm.conditions as {
              ownOnly?: boolean;
              channelIds?: string[];
              collectionIds?: string[];
            };

            // If ownOnly is set, need to verify ownership
            if (conditions.ownOnly) {
              // This would need additional context about resource ownership
              // For now, we'll allow it and let the caller verify ownership
            }

            // If channel/collection restrictions exist, verify
            if (conditions.channelIds && resourceId && !conditions.channelIds.includes(resourceId)) {
              continue;
            }
            if (conditions.collectionIds && resourceId && !conditions.collectionIds.includes(resourceId)) {
              continue;
            }
          }

          return { allowed: true, grantedBy: "role" };
        }
      }
    }

    // Check if user has the default role
    const defaultRole = await db.query.customRoles.findFirst({
      where: and(eq(customRoles.organizationId, organizationId), eq(customRoles.isDefault, true)),
      with: {
        permissions: true,
      },
    });

    if (defaultRole) {
      for (const perm of defaultRole.permissions) {
        if (perm.resource === resource && perm.action === action) {
          return { allowed: true, grantedBy: "role" };
        }
      }
    }

    return { allowed: false, reason: "No matching permission found" };
  }

  /**
   * Check multiple permissions at once
   */
  static async checkPermissions(checks: PermissionCheck[]): Promise<Map<string, PermissionResult>> {
    const results = new Map<string, PermissionResult>();

    for (const check of checks) {
      const key = `${check.resource}:${check.action}:${check.resourceId || "*"}`;
      const result = await RBACService.checkPermission(check);
      results.set(key, result);
    }

    return results;
  }

  /**
   * Get all permissions for a user in an organization
   */
  static async getUserPermissions(
    userId: string,
    organizationId: string,
  ): Promise<Array<{ resource: PermissionResource; action: PermissionAction; conditions?: unknown }>> {
    const permissions: Array<{
      resource: PermissionResource;
      action: PermissionAction;
      conditions?: unknown;
    }> = [];

    // Check if owner
    const membership = await db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.organizationId, organizationId)),
    });

    if (membership?.role === "owner") {
      // Owners have all permissions
      const allResources: PermissionResource[] = [
        "video",
        "channel",
        "collection",
        "comment",
        "member",
        "settings",
        "billing",
        "analytics",
        "integration",
        "audit_log",
      ];
      const allActions: PermissionAction[] = [
        "create",
        "read",
        "update",
        "delete",
        "share",
        "comment",
        "download",
        "manage",
        "invite",
        "admin",
      ];

      for (const resource of allResources) {
        for (const action of allActions) {
          permissions.push({ resource, action });
        }
      }
      return permissions;
    }

    // Get role-based permissions
    const userRoles = await db.query.userRoleAssignments.findMany({
      where: and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.organizationId, organizationId)),
      with: {
        role: {
          with: {
            permissions: true,
          },
        },
      },
    });

    for (const assignment of userRoles) {
      for (const perm of assignment.role.permissions) {
        permissions.push({
          resource: perm.resource,
          action: perm.action,
          conditions: perm.conditions,
        });
      }
    }

    // Get default role permissions if user has no explicit roles
    if (userRoles.length === 0) {
      const defaultRole = await db.query.customRoles.findFirst({
        where: and(eq(customRoles.organizationId, organizationId), eq(customRoles.isDefault, true)),
        with: {
          permissions: true,
        },
      });

      if (defaultRole) {
        for (const perm of defaultRole.permissions) {
          permissions.push({
            resource: perm.resource,
            action: perm.action,
            conditions: perm.conditions,
          });
        }
      }
    }

    // Get resource-specific permissions
    const resourcePerms = await db.query.resourcePermissions.findMany({
      where: and(
        eq(resourcePermissions.organizationId, organizationId),
        eq(resourcePermissions.userId, userId),
        or(isNull(resourcePermissions.expiresAt), eq(resourcePermissions.expiresAt, new Date())),
      ),
    });

    for (const perm of resourcePerms) {
      permissions.push({
        resource: perm.resourceType,
        action: perm.action,
        conditions: { resourceId: perm.resourceId },
      });
    }

    return permissions;
  }

  /**
   * Create a custom role
   */
  static async createRole(
    organizationId: string,
    role: Omit<NewCustomRole, "id" | "organizationId" | "createdAt" | "updatedAt">,
    permissions: Array<{ resource: PermissionResource; action: PermissionAction; conditions?: unknown }>,
    createdBy?: string,
  ): Promise<CustomRole> {
    const roleId = crypto.randomUUID();

    const [newRole] = await db
      .insert(customRoles)
      .values({
        id: roleId,
        organizationId,
        name: role.name,
        description: role.description,
        color: role.color,
        isDefault: role.isDefault || false,
        isSystemRole: false,
      })
      .returning();

    // Add permissions
    if (permissions.length > 0) {
      await db.insert(rolePermissions).values(
        permissions.map((p) => ({
          id: crypto.randomUUID(),
          roleId,
          resource: p.resource,
          action: p.action,
          conditions: p.conditions as RolePermission["conditions"],
        })),
      );
    }

    // Audit log
    if (createdBy) {
      await AuditLogger.log(
        {
          category: "authorization",
          action: "role.created",
          description: `Custom role created: ${role.name}`,
          resourceType: "role",
          resourceId: roleId,
          resourceName: role.name,
          newValue: { ...role, permissions },
        },
        {
          actorId: createdBy,
          organizationId,
        },
      );
    }

    return newRole;
  }

  /**
   * Update a custom role
   */
  static async updateRole(
    roleId: string,
    updates: Partial<Pick<CustomRole, "name" | "description" | "color" | "isDefault">>,
    updatedBy?: string,
  ): Promise<CustomRole | null> {
    const existingRole = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
    });

    if (!existingRole) {
      return null;
    }

    // Don't allow updating system roles
    if (existingRole.isSystemRole) {
      throw new Error("Cannot modify system roles");
    }

    const [updatedRole] = await db
      .update(customRoles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(customRoles.id, roleId))
      .returning();

    // Audit log
    if (updatedBy) {
      await AuditLogger.log(
        {
          category: "authorization",
          action: "role.updated",
          description: `Custom role updated: ${updatedRole.name}`,
          resourceType: "role",
          resourceId: roleId,
          resourceName: updatedRole.name,
          previousValue: existingRole,
          newValue: updatedRole,
        },
        {
          actorId: updatedBy,
          organizationId: existingRole.organizationId,
        },
      );
    }

    return updatedRole;
  }

  /**
   * Delete a custom role
   */
  static async deleteRole(roleId: string, deletedBy?: string): Promise<boolean> {
    const role = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
    });

    if (!role) {
      return false;
    }

    // Don't allow deleting system roles
    if (role.isSystemRole) {
      throw new Error("Cannot delete system roles");
    }

    await db.delete(customRoles).where(eq(customRoles.id, roleId));

    // Audit log
    if (deletedBy) {
      await AuditLogger.log(
        {
          category: "authorization",
          action: "role.deleted",
          description: `Custom role deleted: ${role.name}`,
          resourceType: "role",
          resourceId: roleId,
          resourceName: role.name,
          previousValue: role,
        },
        {
          actorId: deletedBy,
          organizationId: role.organizationId,
        },
      );
    }

    return true;
  }

  /**
   * Update role permissions
   */
  static async updateRolePermissions(
    roleId: string,
    permissions: Array<{ resource: PermissionResource; action: PermissionAction; conditions?: unknown }>,
    updatedBy?: string,
  ): Promise<void> {
    const role = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
      with: { permissions: true },
    });

    if (!role) {
      throw new Error("Role not found");
    }

    // Don't allow updating system role permissions
    if (role.isSystemRole) {
      throw new Error("Cannot modify system role permissions");
    }

    // Get current permissions for audit
    const previousPermissions = role.permissions;

    // Delete existing permissions
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    // Add new permissions
    if (permissions.length > 0) {
      await db.insert(rolePermissions).values(
        permissions.map((p) => ({
          id: crypto.randomUUID(),
          roleId,
          resource: p.resource,
          action: p.action,
          conditions: p.conditions as RolePermission["conditions"],
        })),
      );
    }

    // Audit log
    if (updatedBy) {
      await AuditLogger.log(
        {
          category: "authorization",
          action: "role.permissions_updated",
          description: `Permissions updated for role: ${role.name}`,
          resourceType: "role",
          resourceId: roleId,
          resourceName: role.name,
          previousValue: { permissions: previousPermissions },
          newValue: { permissions },
        },
        {
          actorId: updatedBy,
          organizationId: role.organizationId,
        },
      );
    }
  }

  /**
   * Assign a role to a user
   */
  static async assignRole(
    userId: string,
    organizationId: string,
    roleId: string,
    assignedBy?: string,
  ): Promise<NewUserRoleAssignment> {
    const role = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
    });

    if (!role) {
      throw new Error("Role not found");
    }

    const assignment: NewUserRoleAssignment = {
      id: crypto.randomUUID(),
      userId,
      organizationId,
      roleId,
      assignedBy: assignedBy || null,
    };

    await db.insert(userRoleAssignments).values(assignment);

    // Audit log
    if (assignedBy) {
      await AuditLogger.logAuthz(
        "role_assigned",
        { actorId: assignedBy, organizationId },
        {
          roleName: role.name,
          targetUserId: userId,
        },
      );
    }

    return assignment;
  }

  /**
   * Remove a role from a user
   */
  static async removeRole(userId: string, organizationId: string, roleId: string, removedBy?: string): Promise<void> {
    const role = await db.query.customRoles.findFirst({
      where: eq(customRoles.id, roleId),
    });

    await db
      .delete(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.organizationId, organizationId),
          eq(userRoleAssignments.roleId, roleId),
        ),
      );

    // Audit log
    if (removedBy && role) {
      await AuditLogger.logAuthz(
        "role_removed",
        { actorId: removedBy, organizationId },
        {
          roleName: role.name,
          targetUserId: userId,
        },
      );
    }
  }

  /**
   * Grant resource-level permission
   */
  static async grantResourcePermission(
    organizationId: string,
    resourceType: PermissionResource,
    resourceId: string,
    userId: string,
    action: PermissionAction,
    options?: {
      grantedBy?: string;
      expiresAt?: Date;
    },
  ): Promise<void> {
    await db.insert(resourcePermissions).values({
      id: crypto.randomUUID(),
      organizationId,
      resourceType,
      resourceId,
      userId,
      action,
      grantedBy: options?.grantedBy || null,
      expiresAt: options?.expiresAt || null,
    });

    // Audit log
    if (options?.grantedBy) {
      await AuditLogger.logAuthz(
        "permission_granted",
        { actorId: options.grantedBy, organizationId },
        {
          resourceType,
          resourceId,
          permission: action,
          targetUserId: userId,
        },
      );
    }
  }

  /**
   * Revoke resource-level permission
   */
  static async revokeResourcePermission(
    organizationId: string,
    resourceType: PermissionResource,
    resourceId: string,
    userId: string,
    action: PermissionAction,
    revokedBy?: string,
  ): Promise<void> {
    await db
      .delete(resourcePermissions)
      .where(
        and(
          eq(resourcePermissions.organizationId, organizationId),
          eq(resourcePermissions.resourceType, resourceType),
          eq(resourcePermissions.resourceId, resourceId),
          eq(resourcePermissions.userId, userId),
          eq(resourcePermissions.action, action),
        ),
      );

    // Audit log
    if (revokedBy) {
      await AuditLogger.logAuthz(
        "permission_denied",
        { actorId: revokedBy, organizationId },
        {
          resourceType,
          resourceId,
          permission: action,
          targetUserId: userId,
        },
      );
    }
  }

  /**
   * Get all roles for an organization
   */
  static async getOrganizationRoles(organizationId: string): Promise<CustomRole[]> {
    return db.query.customRoles.findMany({
      where: eq(customRoles.organizationId, organizationId),
      with: {
        permissions: true,
      },
    });
  }

  /**
   * Get roles assigned to a user in an organization
   */
  static async getUserRoles(
    userId: string,
    organizationId: string,
  ): Promise<Array<CustomRole & { permissions: RolePermission[] }>> {
    const assignments = await db.query.userRoleAssignments.findMany({
      where: and(eq(userRoleAssignments.userId, userId), eq(userRoleAssignments.organizationId, organizationId)),
      with: {
        role: {
          with: {
            permissions: true,
          },
        },
      },
    });

    return assignments.map((a) => a.role);
  }

  /**
   * Initialize default roles for a new organization
   */
  static async initializeDefaultRoles(organizationId: string): Promise<void> {
    for (const [key, roleDef] of Object.entries(SYSTEM_ROLES)) {
      const roleId = crypto.randomUUID();

      await db.insert(customRoles).values({
        id: roleId,
        organizationId,
        name: roleDef.name,
        description: roleDef.description,
        color: roleDef.color,
        isDefault: key === "VIEWER", // Viewer is default role
        isSystemRole: true,
      });

      const permValues: NewRolePermission[] = [];
      for (const perm of roleDef.permissions) {
        for (const action of perm.actions) {
          permValues.push({
            id: crypto.randomUUID(),
            roleId,
            resource: perm.resource,
            action: action as PermissionAction,
            conditions: null,
          });
        }
      }

      if (permValues.length > 0) {
        await db.insert(rolePermissions).values(permValues);
      }
    }
  }
}

export default RBACService;
