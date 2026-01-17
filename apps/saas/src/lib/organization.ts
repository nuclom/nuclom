import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { members, organizations } from '@/lib/db/schema';

export async function getActiveOrganization(userId: string) {
  const userMembership = await db
    .select({
      organization: organizations,
    })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(eq(members.userId, userId))
    .limit(1);

  return userMembership[0]?.organization || null;
}

export async function getUserOrganizations(userId: string) {
  const userMemberships = await db
    .select({
      organization: organizations,
      role: members.role,
      joinedAt: members.createdAt,
    })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(eq(members.userId, userId));

  return userMemberships;
}
