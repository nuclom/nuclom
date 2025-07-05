import { db } from "@/lib/db";
import { organizations, members, invitations, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resend } from "@/lib/email";

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
      role: "owner",
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

export async function updateOrganization(organizationId: string, data: { name: string; slug: string; logo?: string }) {
  const updatedOrg = await db
    .update(organizations)
    .set({
      name: data.name,
      slug: data.slug,
      logo: data.logo,
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return updatedOrg[0];
}

export async function deleteOrganization(organizationId: string) {
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

export async function getOrganizationMembers(organizationId: string) {
  const orgMembers = await db
    .select({
      id: members.id,
      role: members.role,
      createdAt: members.createdAt,
      organizationId: members.organizationId,
      userId: members.userId,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.organizationId, organizationId));

  return orgMembers;
}

export async function inviteMember(data: {
  organizationId: string;
  email: string;
  role: "owner" | "member";
  inviterId: string;
}) {
  const existingMember = await db
    .select()
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(and(eq(members.organizationId, data.organizationId), eq(users.email, data.email)))
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error("User is already a member of this organization");
  }

  const existingInvitation = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.organizationId, data.organizationId), eq(invitations.email, data.email)))
    .limit(1);

  if (existingInvitation.length > 0) {
    throw new Error("Invitation already sent to this email");
  }

  const invitation = await db
    .insert(invitations)
    .values({
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      email: data.email,
      role: data.role,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      inviterId: data.inviterId,
    })
    .returning();

  const org = await db.select().from(organizations).where(eq(organizations.id, data.organizationId)).limit(1);

  const inviter = await db.select().from(users).where(eq(users.id, data.inviterId)).limit(1);

  await resend.emails.send({
    from: "noreply@nuclom.com",
    to: data.email,
    subject: `Invitation to join ${org[0].name}`,
    html: `
      <h1>You've been invited to join ${org[0].name}</h1>
      <p>${inviter[0].name} has invited you to join their organization "${org[0].name}" on Nuclom.</p>
      <p>Click the link below to accept the invitation:</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/accept-invitation/${invitation[0].id}">Accept Invitation</a>
      <p>This invitation will expire in 7 days.</p>
    `,
  });

  return invitation[0];
}

export async function updateMemberRole(memberId: string, role: "owner" | "member") {
  const updatedMember = await db.update(members).set({ role }).where(eq(members.id, memberId)).returning();

  return updatedMember[0];
}

export async function removeMember(memberId: string) {
  await db.delete(members).where(eq(members.id, memberId));
}

export async function acceptInvitation(invitationId: string, userId: string) {
  const invitation = await db.select().from(invitations).where(eq(invitations.id, invitationId)).limit(1);

  if (invitation.length === 0) {
    throw new Error("Invitation not found");
  }

  if (invitation[0].expiresAt < new Date()) {
    throw new Error("Invitation has expired");
  }

  if (invitation[0].status !== "pending") {
    throw new Error("Invitation is no longer valid");
  }

  await db.transaction(async (tx) => {
    await tx.insert(members).values({
      id: crypto.randomUUID(),
      organizationId: invitation[0].organizationId,
      userId,
      role: invitation[0].role,
      createdAt: new Date(),
    });

    await tx.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, invitationId));
  });
}
