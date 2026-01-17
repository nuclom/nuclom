/**
 * Better Auth Access Control Configuration
 *
 * This defines the permission structure for the organization plugin.
 * All role-based access control is handled by Better Auth's organization plugin.
 *
 * @see https://www.better-auth.com/docs/plugins/organization
 */
import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Permission statement defining all resources and their possible actions.
 */
export const permissionStatement = {
  // Video content management
  video: ['create', 'read', 'update', 'delete', 'share', 'download', 'comment', 'manage'],

  // Channel management
  channel: ['create', 'read', 'update', 'delete', 'manage'],

  // Collection management
  collection: ['create', 'read', 'update', 'delete', 'share', 'manage'],

  // Comment management
  comment: ['create', 'read', 'update', 'delete', 'comment'],

  // Member management
  member: ['read', 'invite', 'manage', 'admin'],

  // Organization settings
  settings: ['read', 'update', 'manage', 'admin'],

  // Billing management
  billing: ['read', 'update', 'manage', 'admin'],

  // Analytics access
  analytics: ['read'],

  // Integration management
  integration: ['create', 'read', 'update', 'delete', 'manage'],

  // Audit log access
  audit_log: ['read', 'download'],

  // Organization-level permissions (required by Better Auth)
  organization: ['update', 'delete'],

  // Invitation management (required by Better Auth)
  invitation: ['create', 'cancel'],

  // Team management (required by Better Auth for teams feature)
  team: ['create', 'read', 'update', 'delete'],
} as const;

/**
 * Create the access control instance
 */
export const ac = createAccessControl(permissionStatement);

/**
 * Owner Role - Full control over the organization
 */
export const ownerRole = ac.newRole({
  video: ['create', 'read', 'update', 'delete', 'share', 'download', 'comment', 'manage'],
  channel: ['create', 'read', 'update', 'delete', 'manage'],
  collection: ['create', 'read', 'update', 'delete', 'share', 'manage'],
  comment: ['create', 'read', 'update', 'delete', 'comment'],
  member: ['read', 'invite', 'manage', 'admin'],
  settings: ['read', 'update', 'manage', 'admin'],
  billing: ['read', 'update', 'manage', 'admin'],
  analytics: ['read'],
  integration: ['create', 'read', 'update', 'delete', 'manage'],
  audit_log: ['read', 'download'],
  organization: ['update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'read', 'update', 'delete'],
});

/**
 * Admin Role - Administrative access except billing
 */
export const adminRole = ac.newRole({
  video: ['create', 'read', 'update', 'delete', 'share', 'download', 'comment', 'manage'],
  channel: ['create', 'read', 'update', 'delete', 'manage'],
  collection: ['create', 'read', 'update', 'delete', 'share', 'manage'],
  comment: ['create', 'read', 'update', 'delete', 'comment'],
  member: ['read', 'invite', 'manage'],
  settings: ['read', 'update', 'manage'],
  billing: ['read'],
  analytics: ['read'],
  integration: ['create', 'read', 'update', 'delete', 'manage'],
  audit_log: ['read'],
  organization: ['update'],
  invitation: ['create', 'cancel'],
  team: ['create', 'read', 'update', 'delete'],
});

/**
 * Editor Role - Can create and edit content
 */
export const editorRole = ac.newRole({
  video: ['create', 'read', 'update', 'share', 'download', 'comment'],
  channel: ['read'],
  collection: ['create', 'read', 'update', 'share'],
  comment: ['create', 'read', 'update', 'delete', 'comment'],
  member: ['read'],
  analytics: ['read'],
  team: ['read'],
});

/**
 * Member Role (Viewer) - Read-only access
 */
export const memberRole = ac.newRole({
  video: ['read', 'comment', 'download'],
  channel: ['read'],
  collection: ['read'],
  comment: ['read', 'comment'],
  member: ['read'],
  analytics: ['read'],
  team: ['read'],
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
