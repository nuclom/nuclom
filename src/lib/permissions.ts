import { db } from "@/lib/db";
import { members, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type Permission =
  | "organization:read"
  | "organization:write"
  | "organization:delete"
  | "members:read"
  | "members:invite"
  | "members:manage"
  | "members:remove"
  | "videos:read"
  | "videos:write"
  | "videos:delete"
  | "channels:read"
  | "channels:write"
  | "channels:delete"
  | "billing:read"
  | "billing:write";

export type Role = "owner" | "member";

const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    "organization:read",
    "organization:write",
    "organization:delete",
    "members:read",
    "members:invite",
    "members:manage",
    "members:remove",
    "videos:read",
    "videos:write",
    "videos:delete",
    "channels:read",
    "channels:write",
    "channels:delete",
    "billing:read",
    "billing:write",
  ],
  member: ["organization:read", "members:read", "videos:read", "videos:write", "channels:read", "channels:write"],
};

export async function getUserRole(userId: string, organizationId: string): Promise<Role | null> {
  const membership = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
    .limit(1);

  return membership.length > 0 ? membership[0].role : null;
}

export async function hasPermission(userId: string, organizationId: string, permission: Permission): Promise<boolean> {
  const role = await getUserRole(userId, organizationId);
  if (!role) return false;

  return rolePermissions[role].includes(permission);
}

export async function requirePermission(userId: string, organizationId: string, permission: Permission): Promise<void> {
  const hasAccess = await hasPermission(userId, organizationId, permission);
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: ${permission}`);
  }
}

export async function getOrganizationBySlug(slug: string): Promise<string | null> {
  const org = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return org.length > 0 ? org[0].id : null;
}

export function getPermissionsForRole(role: Role): Permission[] {
  return rolePermissions[role];
}
