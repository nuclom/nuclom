/**
 * Organization Repository Service using Effect-TS
 *
 * Provides type-safe database operations for organizations.
 */

import { and, eq, ne } from 'drizzle-orm';
import { Context, Effect, Layer, Option } from 'effect';
import { members, organizations, users } from '@/lib/db/schema';
import { DatabaseError, ForbiddenError, NotFoundError, TransactionError, ValidationError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateOrganizationInput {
  readonly name: string;
  readonly slug: string;
  readonly logo?: string;
  readonly userId: string;
}

export interface UpdateOrganizationInput {
  readonly name?: string;
  readonly slug?: string;
  readonly logo?: string | null;
  readonly metadata?: string;
}

export interface OrganizationWithRole {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly logo: string | null;
  readonly createdAt: Date;
  readonly role: 'owner' | 'member';
}

export interface OrganizationMember {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: 'owner' | 'member';
  readonly createdAt: Date;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image: string | null;
  };
}

export interface OrganizationRepositoryService {
  /**
   * Create a new organization with the user as owner
   */
  readonly createOrganization: (
    data: CreateOrganizationInput,
  ) => Effect.Effect<typeof organizations.$inferSelect, TransactionError>;

  /**
   * Update an organization
   */
  readonly updateOrganization: (
    id: string,
    data: UpdateOrganizationInput,
  ) => Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError | ValidationError>;

  /**
   * Get all organizations for a user with their roles
   */
  readonly getUserOrganizations: (userId: string) => Effect.Effect<ReadonlyArray<OrganizationWithRole>, DatabaseError>;

  /**
   * Get the active organization for a user (first one)
   */
  readonly getActiveOrganization: (userId: string) => Effect.Effect<Option.Option<OrganizationWithRole>, DatabaseError>;

  /**
   * Get an organization by ID
   */
  readonly getOrganization: (
    id: string,
  ) => Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get an organization by slug
   */
  readonly getOrganizationBySlug: (
    slug: string,
  ) => Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Check if user is a member of an organization
   */
  readonly isMember: (userId: string, organizationId: string) => Effect.Effect<boolean, DatabaseError>;

  /**
   * Get user's role in an organization
   */
  readonly getUserRole: (
    userId: string,
    organizationId: string,
  ) => Effect.Effect<Option.Option<'owner' | 'member'>, DatabaseError>;

  /**
   * Get all members of an organization
   */
  readonly getOrganizationMembers: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<OrganizationMember>, DatabaseError>;

  /**
   * Remove a member from an organization
   */
  readonly removeMember: (
    organizationId: string,
    userId: string,
    requesterId: string,
  ) => Effect.Effect<void, DatabaseError | NotFoundError | ForbiddenError>;

  /**
   * Update a member's role in an organization
   */
  readonly updateMemberRole: (
    organizationId: string,
    userId: string,
    newRole: 'owner' | 'member',
    requesterId: string,
  ) => Effect.Effect<typeof members.$inferSelect, DatabaseError | NotFoundError | ForbiddenError>;
}

// =============================================================================
// Organization Repository Tag
// =============================================================================

export class OrganizationRepository extends Context.Tag('OrganizationRepository')<
  OrganizationRepository,
  OrganizationRepositoryService
>() {}

// =============================================================================
// Organization Repository Implementation
// =============================================================================

const makeOrganizationRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const createOrganization = (
    data: CreateOrganizationInput,
  ): Effect.Effect<typeof organizations.$inferSelect, TransactionError> =>
    Effect.tryPromise({
      try: async () => {
        return await db.transaction(async (tx) => {
          // Create organization
          const [org] = await tx
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
            organizationId: org.id,
            userId: data.userId,
            role: 'owner',
            createdAt: new Date(),
          });

          return org;
        });
      },
      catch: (error) =>
        new TransactionError({
          message: 'Failed to create organization',
          cause: error,
        }),
    });

  const getUserOrganizations = (userId: string): Effect.Effect<ReadonlyArray<OrganizationWithRole>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
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

        return userOrgs as ReadonlyArray<OrganizationWithRole>;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch user organizations',
          operation: 'getUserOrganizations',
          cause: error,
        }),
    });

  const getActiveOrganization = (userId: string): Effect.Effect<Option.Option<OrganizationWithRole>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
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

        return activeOrg[0] ? Option.some(activeOrg[0] as OrganizationWithRole) : Option.none();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch active organization',
          operation: 'getActiveOrganization',
          cause: error,
        }),
    });

  const getOrganization = (
    id: string,
  ): Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(organizations).where(eq(organizations.id, id)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch organization',
            operation: 'getOrganization',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Organization not found',
            entity: 'Organization',
            id,
          }),
        );
      }

      return result[0];
    });

  const getOrganizationBySlug = (
    slug: string,
  ): Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch organization by slug',
            operation: 'getOrganizationBySlug',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Organization not found',
            entity: 'Organization',
            id: slug,
          }),
        );
      }

      return result[0];
    });

  const isMember = (userId: string, organizationId: string): Effect.Effect<boolean, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const membership = await db.select().from(members).where(eq(members.userId, userId)).limit(1);

        return membership.some((m) => m.organizationId === organizationId);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check membership',
          operation: 'isMember',
          cause: error,
        }),
    });

  const getUserRole = (
    userId: string,
    organizationId: string,
  ): Effect.Effect<Option.Option<'owner' | 'member'>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const membership = await db
          .select({ role: members.role })
          .from(members)
          .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
          .limit(1);

        return membership[0] ? Option.some(membership[0].role as 'owner' | 'member') : Option.none();
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get user role',
          operation: 'getUserRole',
          cause: error,
        }),
    });

  const updateOrganization = (
    id: string,
    data: UpdateOrganizationInput,
  ): Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError | ValidationError> =>
    Effect.gen(function* () {
      // Check if slug is being updated and if it's unique
      if (data.slug) {
        const newSlug = data.slug;
        const existingOrg = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(organizations)
              .where(and(eq(organizations.slug, newSlug), ne(organizations.id, id)))
              .limit(1),
          catch: (error) =>
            new DatabaseError({
              message: 'Failed to check slug uniqueness',
              operation: 'updateOrganization.checkSlug',
              cause: error,
            }),
        });

        if (existingOrg.length > 0) {
          return yield* Effect.fail(
            new ValidationError({
              message: 'Organization slug already exists',
              field: 'slug',
            }),
          );
        }
      }

      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update organization',
            operation: 'updateOrganization',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Organization not found',
            entity: 'Organization',
            id,
          }),
        );
      }

      return result[0];
    });

  const getOrganizationMembers = (
    organizationId: string,
  ): Effect.Effect<ReadonlyArray<OrganizationMember>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const orgMembers = await db
          .select({
            id: members.id,
            organizationId: members.organizationId,
            userId: members.userId,
            role: members.role,
            createdAt: members.createdAt,
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

        return orgMembers as ReadonlyArray<OrganizationMember>;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch organization members',
          operation: 'getOrganizationMembers',
          cause: error,
        }),
    });

  const removeMember = (
    organizationId: string,
    userId: string,
    requesterId: string,
  ): Effect.Effect<void, DatabaseError | NotFoundError | ForbiddenError> =>
    Effect.gen(function* () {
      // Check requester's role
      const requesterRole = yield* getUserRole(requesterId, organizationId);

      if (Option.isNone(requesterRole) || requesterRole.value !== 'owner') {
        return yield* Effect.fail(
          new ForbiddenError({
            message: 'Only organization owners can remove members',
            resource: 'Organization',
          }),
        );
      }

      // Check if user to remove exists
      const memberToRemove = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(members)
            .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch member',
            operation: 'removeMember.fetch',
            cause: error,
          }),
      });

      if (!memberToRemove.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Member not found in organization',
            entity: 'Member',
            id: userId,
          }),
        );
      }

      // Prevent removing the last owner
      if (memberToRemove[0].role === 'owner') {
        const ownerCount = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(members)
              .where(and(eq(members.organizationId, organizationId), eq(members.role, 'owner'))),
          catch: (error) =>
            new DatabaseError({
              message: 'Failed to count owners',
              operation: 'removeMember.countOwners',
              cause: error,
            }),
        });

        if (ownerCount.length <= 1) {
          return yield* Effect.fail(
            new ForbiddenError({
              message: 'Cannot remove the last owner of an organization',
              resource: 'Organization',
            }),
          );
        }
      }

      // Remove member
      yield* Effect.tryPromise({
        try: () =>
          db.delete(members).where(and(eq(members.userId, userId), eq(members.organizationId, organizationId))),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to remove member',
            operation: 'removeMember',
            cause: error,
          }),
      });
    });

  const updateMemberRole = (
    organizationId: string,
    userId: string,
    newRole: 'owner' | 'member',
    requesterId: string,
  ): Effect.Effect<typeof members.$inferSelect, DatabaseError | NotFoundError | ForbiddenError> =>
    Effect.gen(function* () {
      // Check requester's role
      const requesterRole = yield* getUserRole(requesterId, organizationId);

      if (Option.isNone(requesterRole) || requesterRole.value !== 'owner') {
        return yield* Effect.fail(
          new ForbiddenError({
            message: 'Only organization owners can change member roles',
            resource: 'Organization',
          }),
        );
      }

      // Check if user exists in organization
      const memberToUpdate = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(members)
            .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch member',
            operation: 'updateMemberRole.fetch',
            cause: error,
          }),
      });

      if (!memberToUpdate.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Member not found in organization',
            entity: 'Member',
            id: userId,
          }),
        );
      }

      // Prevent demoting the last owner
      if (memberToUpdate[0].role === 'owner' && newRole === 'member') {
        const ownerCount = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(members)
              .where(and(eq(members.organizationId, organizationId), eq(members.role, 'owner'))),
          catch: (error) =>
            new DatabaseError({
              message: 'Failed to count owners',
              operation: 'updateMemberRole.countOwners',
              cause: error,
            }),
        });

        if (ownerCount.length <= 1) {
          return yield* Effect.fail(
            new ForbiddenError({
              message: 'Cannot demote the last owner of an organization',
              resource: 'Organization',
            }),
          );
        }
      }

      // Update role
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(members)
            .set({ role: newRole })
            .where(and(eq(members.userId, userId), eq(members.organizationId, organizationId)))
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update member role',
            operation: 'updateMemberRole',
            cause: error,
          }),
      });

      return result[0];
    });

  return {
    createOrganization,
    updateOrganization,
    getUserOrganizations,
    getActiveOrganization,
    getOrganization,
    getOrganizationBySlug,
    isMember,
    getUserRole,
    getOrganizationMembers,
    removeMember,
    updateMemberRole,
  } satisfies OrganizationRepositoryService;
});

// =============================================================================
// Organization Repository Layer
// =============================================================================

export const OrganizationRepositoryLive = Layer.effect(OrganizationRepository, makeOrganizationRepositoryService);

// =============================================================================
// Organization Repository Helper Functions
// =============================================================================

export const createOrganization = (
  data: CreateOrganizationInput,
): Effect.Effect<typeof organizations.$inferSelect, TransactionError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.createOrganization(data);
  });

export const getUserOrganizations = (
  userId: string,
): Effect.Effect<ReadonlyArray<OrganizationWithRole>, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getUserOrganizations(userId);
  });

export const getActiveOrganization = (
  userId: string,
): Effect.Effect<Option.Option<OrganizationWithRole>, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getActiveOrganization(userId);
  });

export const getOrganization = (
  id: string,
): Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getOrganization(id);
  });

export const getOrganizationBySlug = (
  slug: string,
): Effect.Effect<typeof organizations.$inferSelect, DatabaseError | NotFoundError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getOrganizationBySlug(slug);
  });

export const isMember = (
  userId: string,
  organizationId: string,
): Effect.Effect<boolean, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.isMember(userId, organizationId);
  });

export const getUserRole = (
  userId: string,
  organizationId: string,
): Effect.Effect<Option.Option<'owner' | 'member'>, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getUserRole(userId, organizationId);
  });

export const updateOrganization = (
  id: string,
  data: UpdateOrganizationInput,
): Effect.Effect<
  typeof organizations.$inferSelect,
  DatabaseError | NotFoundError | ValidationError,
  OrganizationRepository
> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.updateOrganization(id, data);
  });

export const getOrganizationMembers = (
  organizationId: string,
): Effect.Effect<ReadonlyArray<OrganizationMember>, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getOrganizationMembers(organizationId);
  });

export const removeMember = (
  organizationId: string,
  userId: string,
  requesterId: string,
): Effect.Effect<void, DatabaseError | NotFoundError | ForbiddenError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.removeMember(organizationId, userId, requesterId);
  });

export const updateMemberRole = (
  organizationId: string,
  userId: string,
  newRole: 'owner' | 'member',
  requesterId: string,
): Effect.Effect<typeof members.$inferSelect, DatabaseError | NotFoundError | ForbiddenError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.updateMemberRole(organizationId, userId, newRole, requesterId);
  });
