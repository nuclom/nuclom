/**
 * Better Auth Access Control Configuration
 *
 * This defines the permission structure for the organization plugin.
 * All role-based access control is handled by Better Auth's organization plugin.
 *
 * @see https://www.better-auth.com/docs/plugins/organization
 */
import { createAccessControl } from "better-auth/plugins/access";

/**
 * Permission statement defining all resources and their possible actions.
 * This replaces the custom RBAC system previously in src/lib/rbac.ts
 */
export const permissionStatement = {
  // Video content management
  video: ["create", "read", "update", "delete", "share", "download", "comment", "manage"],

  // Channel management
  channel: ["create", "read", "update", "delete", "manage"],

  // Collection management
  collection: ["create", "read", "update", "delete", "share", "manage"],

  // Comment management
  comment: ["create", "read", "update", "delete", "comment"],

  // Member management
  member: ["read", "invite", "manage", "admin"],

  // Organization settings
  settings: ["read", "update", "manage", "admin"],

  // Billing management
  billing: ["read", "update", "manage", "admin"],

  // Analytics access
  analytics: ["read"],

  // Integration management
  integration: ["create", "read", "update", "delete", "manage"],

  // Audit log access
  audit_log: ["read", "download"],

  // Organization-level permissions (required by Better Auth)
  organization: ["update", "delete"],

  // Invitation management (required by Better Auth)
  invitation: ["create", "cancel"],
} as const;

/**
 * Create the access control instance
 */
export const ac = createAccessControl(permissionStatement);

/**
 * Owner Role - Full control over the organization
 *
 * Has access to all resources and all actions including:
 * - Full CRUD on all content (videos, channels, collections)
 * - Member management including admin capabilities
 * - Organization settings and billing
 * - Integrations and audit logs
 */
export const ownerRole = ac.newRole({
  video: ["create", "read", "update", "delete", "share", "download", "comment", "manage"],
  channel: ["create", "read", "update", "delete", "manage"],
  collection: ["create", "read", "update", "delete", "share", "manage"],
  comment: ["create", "read", "update", "delete", "comment"],
  member: ["read", "invite", "manage", "admin"],
  settings: ["read", "update", "manage", "admin"],
  billing: ["read", "update", "manage", "admin"],
  analytics: ["read"],
  integration: ["create", "read", "update", "delete", "manage"],
  audit_log: ["read", "download"],
  organization: ["update", "delete"],
  invitation: ["create", "cancel"],
});

/**
 * Admin Role - Administrative access except billing
 *
 * Has access to most resources with full CRUD:
 * - Full CRUD on all content (videos, channels, collections)
 * - Member management (but not admin-level)
 * - Organization settings management
 * - Read-only billing access
 * - Integrations and audit logs (read-only)
 */
export const adminRole = ac.newRole({
  video: ["create", "read", "update", "delete", "share", "download", "comment", "manage"],
  channel: ["create", "read", "update", "delete", "manage"],
  collection: ["create", "read", "update", "delete", "share", "manage"],
  comment: ["create", "read", "update", "delete", "comment"],
  member: ["read", "invite", "manage"],
  settings: ["read", "update", "manage"],
  billing: ["read"],
  analytics: ["read"],
  integration: ["create", "read", "update", "delete", "manage"],
  audit_log: ["read"],
  organization: ["update"],
  invitation: ["create", "cancel"],
});

/**
 * Editor Role - Can create and edit content
 *
 * Has access to create and edit content:
 * - Create and edit videos, collections
 * - Read channels
 * - Full comment capabilities
 * - Read-only member and analytics access
 */
export const editorRole = ac.newRole({
  video: ["create", "read", "update", "share", "download", "comment"],
  channel: ["read"],
  collection: ["create", "read", "update", "share"],
  comment: ["create", "read", "update", "delete", "comment"],
  member: ["read"],
  analytics: ["read"],
});

/**
 * Member Role (Viewer) - Read-only access
 *
 * Basic access for viewing content:
 * - Read and download videos
 * - Read channels, collections, members
 * - Comment on videos
 * - View analytics
 */
export const memberRole = ac.newRole({
  video: ["read", "comment", "download"],
  channel: ["read"],
  collection: ["read"],
  comment: ["read", "comment"],
  member: ["read"],
  analytics: ["read"],
});

/**
 * Role configuration for Better Auth organization plugin
 */
export const organizationRoles = {
  owner: ownerRole,
  admin: adminRole,
  editor: editorRole,
  member: memberRole,
};

/**
 * Type exports for use in API routes and components
 */
export type PermissionResource = keyof typeof permissionStatement;
export type PermissionAction<R extends PermissionResource = PermissionResource> =
  (typeof permissionStatement)[R][number];
