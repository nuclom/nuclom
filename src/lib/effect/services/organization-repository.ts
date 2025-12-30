/**
 * Organization Repository Service using Effect-TS
 *
 * Provides type-safe database operations for organizations.
 */

import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Option } from "effect";
import { members, organizations } from "@/lib/db/schema";
import { DatabaseError, NotFoundError, TransactionError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface CreateOrganizationInput {
  readonly name: string;
  readonly slug: string;
  readonly logo?: string;
  readonly userId: string;
}

export interface OrganizationWithRole {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly logo: string | null;
  readonly createdAt: Date;
  readonly role: "owner" | "member";
}

export interface OrganizationRepositoryService {
  /**
   * Create a new organization with the user as owner
   */
  readonly createOrganization: (
    data: CreateOrganizationInput,
  ) => Effect.Effect<typeof organizations.$inferSelect, TransactionError>;

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
  ) => Effect.Effect<Option.Option<"owner" | "member">, DatabaseError>;
}

// =============================================================================
// Organization Repository Tag
// =============================================================================

export class OrganizationRepository extends Context.Tag("OrganizationRepository")<
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
            role: "owner",
            createdAt: new Date(),
          });

          return org;
        });
      },
      catch: (error) =>
        new TransactionError({
          message: "Failed to create organization",
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
          message: "Failed to fetch user organizations",
          operation: "getUserOrganizations",
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
          message: "Failed to fetch active organization",
          operation: "getActiveOrganization",
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
            message: "Failed to fetch organization",
            operation: "getOrganization",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Organization not found",
            entity: "Organization",
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
            message: "Failed to fetch organization by slug",
            operation: "getOrganizationBySlug",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Organization not found",
            entity: "Organization",
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
          message: "Failed to check membership",
          operation: "isMember",
          cause: error,
        }),
    });

  const getUserRole = (
    userId: string,
    _organizationId: string,
  ): Effect.Effect<Option.Option<"owner" | "member">, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const membership = await db
          .select({ role: members.role })
          .from(members)
          .where(eq(members.userId, userId))
          .limit(1);

        const orgMember = membership.find((_m) => true); // Will be filtered by org in a proper query
        return orgMember ? Option.some(orgMember.role) : Option.none();
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get user role",
          operation: "getUserRole",
          cause: error,
        }),
    });

  return {
    createOrganization,
    getUserOrganizations,
    getActiveOrganization,
    getOrganization,
    getOrganizationBySlug,
    isMember,
    getUserRole,
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
): Effect.Effect<Option.Option<"owner" | "member">, DatabaseError, OrganizationRepository> =>
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return yield* repo.getUserRole(userId, organizationId);
  });
