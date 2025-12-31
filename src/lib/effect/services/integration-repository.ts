/**
 * Integration Repository Service using Effect-TS
 *
 * Provides type-safe database operations for integrations and imported meetings.
 */

import { and, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import {
  type ImportStatus,
  type IntegrationMetadata,
  type IntegrationProvider,
  importedMeetings,
  integrations,
  type MeetingParticipant,
  users,
  videos,
} from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface CreateIntegrationInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly provider: IntegrationProvider;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly scope?: string;
  readonly metadata?: IntegrationMetadata;
}

export interface UpdateIntegrationInput {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly scope?: string;
  readonly metadata?: IntegrationMetadata;
}

export interface CreateImportedMeetingInput {
  readonly integrationId: string;
  readonly externalId: string;
  readonly meetingTitle?: string;
  readonly meetingDate?: Date;
  readonly duration?: number;
  readonly participants?: MeetingParticipant[];
  readonly downloadUrl?: string;
  readonly fileSize?: number;
}

export interface UpdateImportedMeetingInput {
  readonly videoId?: string;
  readonly importStatus?: ImportStatus;
  readonly importError?: string;
  readonly importedAt?: Date;
}

export interface IntegrationWithUser {
  readonly id: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly provider: IntegrationProvider;
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: Date | null;
  readonly scope: string | null;
  readonly metadata: IntegrationMetadata | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image: string | null;
  };
}

export interface ImportedMeetingWithVideo {
  readonly id: string;
  readonly integrationId: string;
  readonly videoId: string | null;
  readonly externalId: string;
  readonly meetingTitle: string | null;
  readonly meetingDate: Date | null;
  readonly duration: number | null;
  readonly participants: MeetingParticipant[] | null;
  readonly downloadUrl: string | null;
  readonly fileSize: number | null;
  readonly importStatus: ImportStatus;
  readonly importError: string | null;
  readonly importedAt: Date | null;
  readonly createdAt: Date;
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
  } | null;
}

// =============================================================================
// Integration Repository Interface
// =============================================================================

export interface IntegrationRepositoryService {
  /**
   * Get all integrations for an organization
   */
  readonly getIntegrations: (organizationId: string) => Effect.Effect<IntegrationWithUser[], DatabaseError>;

  /**
   * Get all integrations for a user in an organization
   */
  readonly getUserIntegrations: (
    userId: string,
    organizationId: string,
  ) => Effect.Effect<(typeof integrations.$inferSelect)[], DatabaseError>;

  /**
   * Get a specific integration by ID
   */
  readonly getIntegration: (
    id: string,
  ) => Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get a specific integration by user and provider
   */
  readonly getIntegrationByProvider: (
    userId: string,
    provider: IntegrationProvider,
  ) => Effect.Effect<typeof integrations.$inferSelect | null, DatabaseError>;

  /**
   * Create a new integration
   */
  readonly createIntegration: (
    data: CreateIntegrationInput,
  ) => Effect.Effect<typeof integrations.$inferSelect, DatabaseError>;

  /**
   * Update an integration
   */
  readonly updateIntegration: (
    id: string,
    data: UpdateIntegrationInput,
  ) => Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete an integration
   */
  readonly deleteIntegration: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Get imported meetings for an integration
   */
  readonly getImportedMeetings: (integrationId: string) => Effect.Effect<ImportedMeetingWithVideo[], DatabaseError>;

  /**
   * Get a specific imported meeting
   */
  readonly getImportedMeeting: (
    id: string,
  ) => Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get imported meeting by external ID
   */
  readonly getImportedMeetingByExternalId: (
    integrationId: string,
    externalId: string,
  ) => Effect.Effect<typeof importedMeetings.$inferSelect | null, DatabaseError>;

  /**
   * Create a new imported meeting
   */
  readonly createImportedMeeting: (
    data: CreateImportedMeetingInput,
  ) => Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError>;

  /**
   * Update an imported meeting
   */
  readonly updateImportedMeeting: (
    id: string,
    data: UpdateImportedMeetingInput,
  ) => Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get pending imports for processing
   */
  readonly getPendingImports: () => Effect.Effect<(typeof importedMeetings.$inferSelect)[], DatabaseError>;
}

// =============================================================================
// Integration Repository Tag
// =============================================================================

export class IntegrationRepository extends Context.Tag("IntegrationRepository")<
  IntegrationRepository,
  IntegrationRepositoryService
>() {}

// =============================================================================
// Integration Repository Implementation
// =============================================================================

const makeIntegrationRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getIntegrations = (organizationId: string): Effect.Effect<IntegrationWithUser[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: integrations.id,
            userId: integrations.userId,
            organizationId: integrations.organizationId,
            provider: integrations.provider,
            accessToken: integrations.accessToken,
            refreshToken: integrations.refreshToken,
            expiresAt: integrations.expiresAt,
            scope: integrations.scope,
            metadata: integrations.metadata,
            createdAt: integrations.createdAt,
            updatedAt: integrations.updatedAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(integrations)
          .innerJoin(users, eq(integrations.userId, users.id))
          .where(eq(integrations.organizationId, organizationId))
          .orderBy(desc(integrations.createdAt));

        return results as IntegrationWithUser[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch integrations",
          operation: "getIntegrations",
          cause: error,
        }),
    });

  const getUserIntegrations = (
    userId: string,
    organizationId: string,
  ): Effect.Effect<(typeof integrations.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(integrations)
          .where(and(eq(integrations.userId, userId), eq(integrations.organizationId, organizationId)))
          .orderBy(desc(integrations.createdAt));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch user integrations",
          operation: "getUserIntegrations",
          cause: error,
        }),
    });

  const getIntegration = (id: string): Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch integration",
            operation: "getIntegration",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Integration not found",
            entity: "Integration",
            id,
          }),
        );
      }

      return result[0];
    });

  const getIntegrationByProvider = (
    userId: string,
    provider: IntegrationProvider,
  ): Effect.Effect<typeof integrations.$inferSelect | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select()
          .from(integrations)
          .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
          .limit(1);

        return result[0] || null;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch integration by provider",
          operation: "getIntegrationByProvider",
          cause: error,
        }),
    });

  const createIntegration = (
    data: CreateIntegrationInput,
  ): Effect.Effect<typeof integrations.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newIntegration] = await db.insert(integrations).values(data).returning();
        return newIntegration;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create integration",
          operation: "createIntegration",
          cause: error,
        }),
    });

  const updateIntegration = (
    id: string,
    data: UpdateIntegrationInput,
  ): Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(integrations)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(integrations.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update integration",
            operation: "updateIntegration",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Integration not found",
            entity: "Integration",
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteIntegration = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(integrations).where(eq(integrations.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete integration",
            operation: "deleteIntegration",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Integration not found",
            entity: "Integration",
            id,
          }),
        );
      }
    });

  const getImportedMeetings = (integrationId: string): Effect.Effect<ImportedMeetingWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: importedMeetings.id,
            integrationId: importedMeetings.integrationId,
            videoId: importedMeetings.videoId,
            externalId: importedMeetings.externalId,
            meetingTitle: importedMeetings.meetingTitle,
            meetingDate: importedMeetings.meetingDate,
            duration: importedMeetings.duration,
            participants: importedMeetings.participants,
            downloadUrl: importedMeetings.downloadUrl,
            fileSize: importedMeetings.fileSize,
            importStatus: importedMeetings.importStatus,
            importError: importedMeetings.importError,
            importedAt: importedMeetings.importedAt,
            createdAt: importedMeetings.createdAt,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
            },
          })
          .from(importedMeetings)
          .leftJoin(videos, eq(importedMeetings.videoId, videos.id))
          .where(eq(importedMeetings.integrationId, integrationId))
          .orderBy(desc(importedMeetings.createdAt));

        return results as ImportedMeetingWithVideo[];
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch imported meetings",
          operation: "getImportedMeetings",
          cause: error,
        }),
    });

  const getImportedMeeting = (
    id: string,
  ): Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(importedMeetings).where(eq(importedMeetings.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch imported meeting",
            operation: "getImportedMeeting",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Imported meeting not found",
            entity: "ImportedMeeting",
            id,
          }),
        );
      }

      return result[0];
    });

  const getImportedMeetingByExternalId = (
    integrationId: string,
    externalId: string,
  ): Effect.Effect<typeof importedMeetings.$inferSelect | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select()
          .from(importedMeetings)
          .where(and(eq(importedMeetings.integrationId, integrationId), eq(importedMeetings.externalId, externalId)))
          .limit(1);

        return result[0] || null;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch imported meeting by external ID",
          operation: "getImportedMeetingByExternalId",
          cause: error,
        }),
    });

  const createImportedMeeting = (
    data: CreateImportedMeetingInput,
  ): Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newMeeting] = await db.insert(importedMeetings).values(data).returning();
        return newMeeting;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create imported meeting",
          operation: "createImportedMeeting",
          cause: error,
        }),
    });

  const updateImportedMeeting = (
    id: string,
    data: UpdateImportedMeetingInput,
  ): Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.update(importedMeetings).set(data).where(eq(importedMeetings.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update imported meeting",
            operation: "updateImportedMeeting",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Imported meeting not found",
            entity: "ImportedMeeting",
            id,
          }),
        );
      }

      return result[0];
    });

  const getPendingImports = (): Effect.Effect<(typeof importedMeetings.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(importedMeetings)
          .where(eq(importedMeetings.importStatus, "pending"))
          .orderBy(importedMeetings.createdAt);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch pending imports",
          operation: "getPendingImports",
          cause: error,
        }),
    });

  return {
    getIntegrations,
    getUserIntegrations,
    getIntegration,
    getIntegrationByProvider,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    getImportedMeetings,
    getImportedMeeting,
    getImportedMeetingByExternalId,
    createImportedMeeting,
    updateImportedMeeting,
    getPendingImports,
  } satisfies IntegrationRepositoryService;
});

// =============================================================================
// Integration Repository Layer
// =============================================================================

export const IntegrationRepositoryLive = Layer.effect(IntegrationRepository, makeIntegrationRepositoryService);

// =============================================================================
// Integration Repository Helper Functions
// =============================================================================

export const getIntegrations = (
  organizationId: string,
): Effect.Effect<IntegrationWithUser[], DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.getIntegrations(organizationId);
  });

export const getUserIntegrations = (
  userId: string,
  organizationId: string,
): Effect.Effect<(typeof integrations.$inferSelect)[], DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.getUserIntegrations(userId, organizationId);
  });

export const getIntegration = (
  id: string,
): Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.getIntegration(id);
  });

export const getIntegrationByProvider = (
  userId: string,
  provider: IntegrationProvider,
): Effect.Effect<typeof integrations.$inferSelect | null, DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.getIntegrationByProvider(userId, provider);
  });

export const createIntegration = (
  data: CreateIntegrationInput,
): Effect.Effect<typeof integrations.$inferSelect, DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.createIntegration(data);
  });

export const updateIntegration = (
  id: string,
  data: UpdateIntegrationInput,
): Effect.Effect<typeof integrations.$inferSelect, DatabaseError | NotFoundError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.updateIntegration(id, data);
  });

export const deleteIntegration = (
  id: string,
): Effect.Effect<void, DatabaseError | NotFoundError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.deleteIntegration(id);
  });

export const getImportedMeetings = (
  integrationId: string,
): Effect.Effect<ImportedMeetingWithVideo[], DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.getImportedMeetings(integrationId);
  });

export const createImportedMeeting = (
  data: CreateImportedMeetingInput,
): Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.createImportedMeeting(data);
  });

export const updateImportedMeeting = (
  id: string,
  data: UpdateImportedMeetingInput,
): Effect.Effect<typeof importedMeetings.$inferSelect, DatabaseError | NotFoundError, IntegrationRepository> =>
  Effect.gen(function* () {
    const repo = yield* IntegrationRepository;
    return yield* repo.updateImportedMeeting(id, data);
  });
