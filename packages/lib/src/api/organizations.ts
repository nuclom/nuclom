import { eq } from 'drizzle-orm';
import { db } from '../db';
import { members, organizations } from '../db/schema';

export async function createOrganization(data: { name: string; slug: string; logo?: string; userId: string }) {
  const newOrganization = await db.transaction(async (tx) => {
    // Create organization
    const org = await tx
      .insert(organizations)
      .values({
        id: crypto.randomUUID(),
        name: data.name,
        slug: data.slug,
        logo: data.logo,
        createdAt: new Date(),
      })
      .returning();

    // Add user as owner
    await tx.insert(members).values({
      id: crypto.randomUUID(),
      organizationId: org[0].id,
      userId: data.userId,
      role: 'owner',
      createdAt: new Date(),
    });

    return org[0];
  });

  return newOrganization;
}

export async function getUserOrganizations(userId: string) {
  const userOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      createdAt: organizations.createdAt,
      role: members.role,
    })
    .from(organizations)
    .innerJoin(members, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId));

  return userOrgs;
}

export async function getActiveOrganization(userId: string) {
  const activeOrg = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      logo: organizations.logo,
      createdAt: organizations.createdAt,
      role: members.role,
    })
    .from(organizations)
    .innerJoin(members, eq(organizations.id, members.organizationId))
    .where(eq(members.userId, userId))
    .limit(1);

  return activeOrg[0] || null;
}
