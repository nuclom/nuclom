/**
 * Decision Repository Service using Effect-TS
 *
 * Provides type-safe database operations for the Decision Registry.
 */

import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import {
  decisionEdits,
  decisionLinks,
  decisionParticipants,
  decisions,
  decisionSubscriptions,
  decisionTagAssignments,
  decisionTags,
  users,
  videos,
} from "@/lib/db/schema";
import type {
  DecisionFilters,
  DecisionWithDetails,
  DecisionWithSummary,
  PaginatedResponse,
} from "@/lib/types";
import { DatabaseError, NotFoundError } from "../errors";
import { Database } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface CreateDecisionInput {
  readonly organizationId: string;
  readonly summary: string;
  readonly context?: string;
  readonly source?: "meeting" | "adhoc" | "manual";
  readonly videoId?: string;
  readonly videoTimestamp?: number;
  readonly status?: "decided" | "proposed" | "superseded";
  readonly decidedAt?: Date;
  readonly createdById?: string;
  readonly participantIds?: string[];
  readonly tagIds?: string[];
}

export interface UpdateDecisionInput {
  readonly summary?: string;
  readonly context?: string | null;
  readonly status?: "decided" | "proposed" | "superseded";
  readonly supersededById?: string | null;
  readonly decidedAt?: Date;
}

export interface CreateDecisionTagInput {
  readonly organizationId: string;
  readonly name: string;
  readonly color?: string;
}

export interface CreateDecisionLinkInput {
  readonly decisionId: string;
  readonly linkType: "supersedes" | "related" | "outcome";
  readonly targetDecisionId?: string;
  readonly targetType?: string;
  readonly targetUrl?: string;
  readonly targetTitle?: string;
  readonly createdById?: string;
}

export interface DecisionRepositoryService {
  /**
   * Get paginated decisions for an organization with filters
   */
  readonly getDecisions: (
    organizationId: string,
    filters?: DecisionFilters,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError>;

  /**
   * Get a single decision with full details
   */
  readonly getDecisionById: (id: string) => Effect.Effect<DecisionWithDetails, DatabaseError | NotFoundError>;

  /**
   * Create a new decision
   */
  readonly createDecision: (data: CreateDecisionInput) => Effect.Effect<typeof decisions.$inferSelect, DatabaseError>;

  /**
   * Update a decision
   */
  readonly updateDecision: (
    id: string,
    data: UpdateDecisionInput,
    userId: string,
  ) => Effect.Effect<typeof decisions.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete a decision
   */
  readonly deleteDecision: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Add a participant to a decision
   */
  readonly addParticipant: (
    decisionId: string,
    userId: string,
  ) => Effect.Effect<typeof decisionParticipants.$inferSelect, DatabaseError>;

  /**
   * Remove a participant from a decision
   */
  readonly removeParticipant: (decisionId: string, userId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Get or create a tag by name
   */
  readonly getOrCreateTag: (
    organizationId: string,
    name: string,
    color?: string,
  ) => Effect.Effect<typeof decisionTags.$inferSelect, DatabaseError>;

  /**
   * Get all tags for an organization
   */
  readonly getTags: (organizationId: string) => Effect.Effect<(typeof decisionTags.$inferSelect)[], DatabaseError>;

  /**
   * Add a tag to a decision
   */
  readonly addTag: (
    decisionId: string,
    tagId: string,
  ) => Effect.Effect<typeof decisionTagAssignments.$inferSelect, DatabaseError>;

  /**
   * Remove a tag from a decision
   */
  readonly removeTag: (decisionId: string, tagId: string) => Effect.Effect<void, DatabaseError>;

  /**
   * Create a link between decisions or to external artifacts
   */
  readonly createLink: (data: CreateDecisionLinkInput) => Effect.Effect<typeof decisionLinks.$inferSelect, DatabaseError>;

  /**
   * Delete a link
   */
  readonly deleteLink: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Supersede a decision with a new one
   */
  readonly supersedeDecision: (
    oldDecisionId: string,
    newDecisionId: string,
    userId: string,
  ) => Effect.Effect<typeof decisions.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get or create a subscription for a user
   */
  readonly getOrCreateSubscription: (
    userId: string,
    organizationId: string,
    topics: string[],
    frequency?: "immediate" | "daily" | "weekly",
  ) => Effect.Effect<typeof decisionSubscriptions.$inferSelect, DatabaseError>;

  /**
   * Update subscription topics
   */
  readonly updateSubscription: (
    userId: string,
    organizationId: string,
    topics: string[],
    frequency?: "immediate" | "daily" | "weekly",
  ) => Effect.Effect<typeof decisionSubscriptions.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Get user's subscription for an organization
   */
  readonly getSubscription: (
    userId: string,
    organizationId: string,
  ) => Effect.Effect<typeof decisionSubscriptions.$inferSelect | null, DatabaseError>;

  /**
   * Search decisions by text
   */
  readonly searchDecisions: (
    organizationId: string,
    query: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError>;

  /**
   * Get decision edit history
   */
  readonly getDecisionEdits: (
    decisionId: string,
  ) => Effect.Effect<(typeof decisionEdits.$inferSelect & { user: typeof users.$inferSelect })[], DatabaseError>;
}

// =============================================================================
// Decision Repository Tag
// =============================================================================

export class DecisionRepository extends Context.Tag("DecisionRepository")<
  DecisionRepository,
  DecisionRepositoryService
>() {}

// =============================================================================
// Decision Repository Implementation
// =============================================================================

const makeDecisionRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getDecisions = (
    organizationId: string,
    filters?: DecisionFilters,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        // Build where conditions
        const conditions = [eq(decisions.organizationId, organizationId)];

        if (filters?.status) {
          conditions.push(eq(decisions.status, filters.status));
        }

        if (filters?.source) {
          conditions.push(eq(decisions.source, filters.source));
        }

        if (filters?.from) {
          conditions.push(gte(decisions.decidedAt, filters.from));
        }

        if (filters?.to) {
          conditions.push(lte(decisions.decidedAt, filters.to));
        }

        if (filters?.videoId) {
          conditions.push(eq(decisions.videoId, filters.videoId));
        }

        if (filters?.search) {
          conditions.push(
            or(
              ilike(decisions.summary, `%${filters.search}%`),
              ilike(decisions.context, `%${filters.search}%`),
            ) ?? sql`true`,
          );
        }

        // Get decisions
        const decisionsData = await db
          .select({
            id: decisions.id,
            organizationId: decisions.organizationId,
            summary: decisions.summary,
            context: decisions.context,
            source: decisions.source,
            videoId: decisions.videoId,
            videoTimestamp: decisions.videoTimestamp,
            status: decisions.status,
            supersededById: decisions.supersededById,
            decidedAt: decisions.decidedAt,
            createdById: decisions.createdById,
            createdAt: decisions.createdAt,
            updatedAt: decisions.updatedAt,
          })
          .from(decisions)
          .where(and(...conditions))
          .orderBy(desc(decisions.decidedAt))
          .offset(offset)
          .limit(limit);

        // Get total count
        const totalResult = await db
          .select({ count: count() })
          .from(decisions)
          .where(and(...conditions));
        const total = totalResult[0]?.count ?? 0;

        // Enrich with participants and tags
        const enrichedDecisions = await Promise.all(
          decisionsData.map(async (decision) => {
            // Get participants
            const participantsData = await db
              .select({
                id: decisionParticipants.id,
                decisionId: decisionParticipants.decisionId,
                userId: decisionParticipants.userId,
                createdAt: decisionParticipants.createdAt,
                user: {
                  id: users.id,
                  name: users.name,
                  email: users.email,
                  image: users.image,
                  emailVerified: users.emailVerified,
                  createdAt: users.createdAt,
                  updatedAt: users.updatedAt,
                  role: users.role,
                  banned: users.banned,
                  banReason: users.banReason,
                  banExpires: users.banExpires,
                  twoFactorEnabled: users.twoFactorEnabled,
                },
              })
              .from(decisionParticipants)
              .innerJoin(users, eq(decisionParticipants.userId, users.id))
              .where(eq(decisionParticipants.decisionId, decision.id));

            // Get tag assignments
            const tagAssignmentsData = await db
              .select({
                id: decisionTagAssignments.id,
                decisionId: decisionTagAssignments.decisionId,
                tagId: decisionTagAssignments.tagId,
                createdAt: decisionTagAssignments.createdAt,
                tag: {
                  id: decisionTags.id,
                  organizationId: decisionTags.organizationId,
                  name: decisionTags.name,
                  color: decisionTags.color,
                  createdAt: decisionTags.createdAt,
                },
              })
              .from(decisionTagAssignments)
              .innerJoin(decisionTags, eq(decisionTagAssignments.tagId, decisionTags.id))
              .where(eq(decisionTagAssignments.decisionId, decision.id));

            // Get video if exists
            let video = null;
            if (decision.videoId) {
              const videoResult = await db
                .select()
                .from(videos)
                .where(eq(videos.id, decision.videoId))
                .limit(1);
              video = videoResult[0] ?? null;
            }

            // Get creator if exists
            let createdBy = null;
            if (decision.createdById) {
              const creatorResult = await db
                .select()
                .from(users)
                .where(eq(users.id, decision.createdById))
                .limit(1);
              createdBy = creatorResult[0] ?? null;
            }

            return {
              ...decision,
              participants: participantsData,
              tagAssignments: tagAssignmentsData,
              video,
              createdBy,
              participantCount: participantsData.length,
              tagCount: tagAssignmentsData.length,
            } as DecisionWithSummary;
          }),
        );

        // Filter by participants if needed
        let filteredDecisions = enrichedDecisions;
        if (filters?.participants && filters.participants.length > 0) {
          filteredDecisions = enrichedDecisions.filter((d) =>
            d.participants.some((p) => filters.participants?.includes(p.userId)),
          );
        }

        // Filter by topics if needed
        if (filters?.topics && filters.topics.length > 0) {
          filteredDecisions = filteredDecisions.filter((d) =>
            d.tagAssignments.some((ta) => filters.topics?.includes(ta.tag.name)),
          );
        }

        return {
          data: filteredDecisions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch decisions",
          operation: "getDecisions",
          cause: error,
        }),
    });

  const getDecisionById = (id: string): Effect.Effect<DecisionWithDetails, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const decisionData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision",
            operation: "getDecisionById",
            cause: error,
          }),
      });

      if (!decisionData.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Decision not found",
            entity: "Decision",
            id,
          }),
        );
      }

      const decision = decisionData[0];

      // Get participants
      const participantsData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: decisionParticipants.id,
              decisionId: decisionParticipants.decisionId,
              userId: decisionParticipants.userId,
              createdAt: decisionParticipants.createdAt,
              user: {
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
                emailVerified: users.emailVerified,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
                role: users.role,
                banned: users.banned,
                banReason: users.banReason,
                banExpires: users.banExpires,
                twoFactorEnabled: users.twoFactorEnabled,
              },
            })
            .from(decisionParticipants)
            .innerJoin(users, eq(decisionParticipants.userId, users.id))
            .where(eq(decisionParticipants.decisionId, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision participants",
            operation: "getDecisionById.participants",
            cause: error,
          }),
      });

      // Get tag assignments
      const tagAssignmentsData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select({
              id: decisionTagAssignments.id,
              decisionId: decisionTagAssignments.decisionId,
              tagId: decisionTagAssignments.tagId,
              createdAt: decisionTagAssignments.createdAt,
              tag: {
                id: decisionTags.id,
                organizationId: decisionTags.organizationId,
                name: decisionTags.name,
                color: decisionTags.color,
                createdAt: decisionTags.createdAt,
              },
            })
            .from(decisionTagAssignments)
            .innerJoin(decisionTags, eq(decisionTagAssignments.tagId, decisionTags.id))
            .where(eq(decisionTagAssignments.decisionId, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision tags",
            operation: "getDecisionById.tags",
            cause: error,
          }),
      });

      // Get links
      const linksData = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(decisionLinks).where(eq(decisionLinks.decisionId, id));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision links",
            operation: "getDecisionById.links",
            cause: error,
          }),
      });

      // Get video if exists
      let video = null;
      if (decision.videoId) {
        const videoResult = yield* Effect.tryPromise({
          try: async () => {
            return await db.select().from(videos).where(eq(videos.id, decision.videoId!)).limit(1);
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to fetch decision video",
              operation: "getDecisionById.video",
              cause: error,
            }),
        });
        video = videoResult[0] ?? null;
      }

      // Get creator if exists
      let createdBy = null;
      if (decision.createdById) {
        const creatorResult = yield* Effect.tryPromise({
          try: async () => {
            return await db.select().from(users).where(eq(users.id, decision.createdById!)).limit(1);
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to fetch decision creator",
              operation: "getDecisionById.creator",
              cause: error,
            }),
        });
        createdBy = creatorResult[0] ?? null;
      }

      // Get superseded by if exists
      let supersededBy = null;
      if (decision.supersededById) {
        const supersededByResult = yield* Effect.tryPromise({
          try: async () => {
            return await db
              .select()
              .from(decisions)
              .where(eq(decisions.id, decision.supersededById!))
              .limit(1);
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to fetch superseded decision",
              operation: "getDecisionById.supersededBy",
              cause: error,
            }),
        });
        supersededBy = supersededByResult[0] ?? null;
      }

      // Get edit history
      const editsData = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(decisionEdits)
            .where(eq(decisionEdits.decisionId, id))
            .orderBy(desc(decisionEdits.editedAt));
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision edits",
            operation: "getDecisionById.edits",
            cause: error,
          }),
      });

      return {
        ...decision,
        participants: participantsData,
        tagAssignments: tagAssignmentsData,
        links: linksData,
        video,
        createdBy,
        supersededBy,
        edits: editsData,
      } as DecisionWithDetails;
    });

  const createDecision = (
    data: CreateDecisionInput,
  ): Effect.Effect<typeof decisions.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newDecision] = await db
          .insert(decisions)
          .values({
            organizationId: data.organizationId,
            summary: data.summary,
            context: data.context,
            source: data.source ?? "manual",
            videoId: data.videoId,
            videoTimestamp: data.videoTimestamp,
            status: data.status ?? "decided",
            decidedAt: data.decidedAt ?? new Date(),
            createdById: data.createdById,
          })
          .returning();

        // Add participants if provided
        if (data.participantIds && data.participantIds.length > 0) {
          await db.insert(decisionParticipants).values(
            data.participantIds.map((userId) => ({
              decisionId: newDecision.id,
              userId,
            })),
          );
        }

        // Add tags if provided
        if (data.tagIds && data.tagIds.length > 0) {
          await db.insert(decisionTagAssignments).values(
            data.tagIds.map((tagId) => ({
              decisionId: newDecision.id,
              tagId,
            })),
          );
        }

        return newDecision;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create decision",
          operation: "createDecision",
          cause: error,
        }),
    });

  const updateDecision = (
    id: string,
    data: UpdateDecisionInput,
    userId: string,
  ): Effect.Effect<typeof decisions.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Get current decision for audit trail
      const currentDecision = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to fetch decision for update",
            operation: "updateDecision.fetch",
            cause: error,
          }),
      });

      if (!currentDecision.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Decision not found",
            entity: "Decision",
            id,
          }),
        );
      }

      const old = currentDecision[0];

      // Update the decision
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(decisions)
            .set({
              ...data,
              updatedAt: new Date(),
            })
            .where(eq(decisions.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update decision",
            operation: "updateDecision",
            cause: error,
          }),
      });

      // Create audit trail entries for changed fields
      const edits: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      if (data.summary !== undefined && data.summary !== old.summary) {
        edits.push({ field: "summary", oldValue: old.summary, newValue: data.summary });
      }
      if (data.context !== undefined && data.context !== old.context) {
        edits.push({ field: "context", oldValue: old.context, newValue: data.context });
      }
      if (data.status !== undefined && data.status !== old.status) {
        edits.push({ field: "status", oldValue: old.status, newValue: data.status });
      }

      if (edits.length > 0) {
        yield* Effect.tryPromise({
          try: async () => {
            await db.insert(decisionEdits).values(
              edits.map((edit) => ({
                decisionId: id,
                userId,
                fieldChanged: edit.field,
                oldValue: edit.oldValue,
                newValue: edit.newValue,
              })),
            );
          },
          catch: (error) =>
            new DatabaseError({
              message: "Failed to create edit audit trail",
              operation: "updateDecision.audit",
              cause: error,
            }),
        });
      }

      return result[0];
    });

  const deleteDecision = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(decisions).where(eq(decisions.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete decision",
            operation: "deleteDecision",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Decision not found",
            entity: "Decision",
            id,
          }),
        );
      }
    });

  const addParticipant = (
    decisionId: string,
    userId: string,
  ): Effect.Effect<typeof decisionParticipants.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [participant] = await db
          .insert(decisionParticipants)
          .values({ decisionId, userId })
          .onConflictDoNothing()
          .returning();
        return participant;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to add participant",
          operation: "addParticipant",
          cause: error,
        }),
    });

  const removeParticipant = (decisionId: string, userId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .delete(decisionParticipants)
          .where(and(eq(decisionParticipants.decisionId, decisionId), eq(decisionParticipants.userId, userId)));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to remove participant",
          operation: "removeParticipant",
          cause: error,
        }),
    });

  const getOrCreateTag = (
    organizationId: string,
    name: string,
    color?: string,
  ): Effect.Effect<typeof decisionTags.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Check if tag exists
        const existing = await db
          .select()
          .from(decisionTags)
          .where(and(eq(decisionTags.organizationId, organizationId), eq(decisionTags.name, name)))
          .limit(1);

        if (existing.length) {
          return existing[0];
        }

        // Create new tag
        const [newTag] = await db
          .insert(decisionTags)
          .values({ organizationId, name, color })
          .returning();
        return newTag;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get or create tag",
          operation: "getOrCreateTag",
          cause: error,
        }),
    });

  const getTags = (
    organizationId: string,
  ): Effect.Effect<(typeof decisionTags.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(decisionTags)
          .where(eq(decisionTags.organizationId, organizationId))
          .orderBy(decisionTags.name);
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch tags",
          operation: "getTags",
          cause: error,
        }),
    });

  const addTag = (
    decisionId: string,
    tagId: string,
  ): Effect.Effect<typeof decisionTagAssignments.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [assignment] = await db
          .insert(decisionTagAssignments)
          .values({ decisionId, tagId })
          .onConflictDoNothing()
          .returning();
        return assignment;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to add tag",
          operation: "addTag",
          cause: error,
        }),
    });

  const removeTag = (decisionId: string, tagId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .delete(decisionTagAssignments)
          .where(
            and(eq(decisionTagAssignments.decisionId, decisionId), eq(decisionTagAssignments.tagId, tagId)),
          );
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to remove tag",
          operation: "removeTag",
          cause: error,
        }),
    });

  const createLink = (
    data: CreateDecisionLinkInput,
  ): Effect.Effect<typeof decisionLinks.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [link] = await db.insert(decisionLinks).values(data).returning();
        return link;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create link",
          operation: "createLink",
          cause: error,
        }),
    });

  const deleteLink = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(decisionLinks).where(eq(decisionLinks.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to delete link",
            operation: "deleteLink",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Link not found",
            entity: "DecisionLink",
            id,
          }),
        );
      }
    });

  const supersedeDecision = (
    oldDecisionId: string,
    newDecisionId: string,
    userId: string,
  ): Effect.Effect<typeof decisions.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Update old decision to mark as superseded
      const result = yield* updateDecision(
        oldDecisionId,
        {
          status: "superseded",
          supersededById: newDecisionId,
        },
        userId,
      );

      // Create supersedes link
      yield* createLink({
        decisionId: newDecisionId,
        linkType: "supersedes",
        targetDecisionId: oldDecisionId,
        createdById: userId,
      });

      return result;
    });

  const getOrCreateSubscription = (
    userId: string,
    organizationId: string,
    topics: string[],
    frequency: "immediate" | "daily" | "weekly" = "weekly",
  ): Effect.Effect<typeof decisionSubscriptions.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Check if subscription exists
        const existing = await db
          .select()
          .from(decisionSubscriptions)
          .where(
            and(
              eq(decisionSubscriptions.userId, userId),
              eq(decisionSubscriptions.organizationId, organizationId),
            ),
          )
          .limit(1);

        if (existing.length) {
          // Update existing subscription
          const [updated] = await db
            .update(decisionSubscriptions)
            .set({ topics, frequency, updatedAt: new Date() })
            .where(eq(decisionSubscriptions.id, existing[0].id))
            .returning();
          return updated;
        }

        // Create new subscription
        const [newSub] = await db
          .insert(decisionSubscriptions)
          .values({ userId, organizationId, topics, frequency })
          .returning();
        return newSub;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to get or create subscription",
          operation: "getOrCreateSubscription",
          cause: error,
        }),
    });

  const updateSubscription = (
    userId: string,
    organizationId: string,
    topics: string[],
    frequency?: "immediate" | "daily" | "weekly",
  ): Effect.Effect<typeof decisionSubscriptions.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(decisionSubscriptions)
            .set({
              topics,
              ...(frequency ? { frequency } : {}),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(decisionSubscriptions.userId, userId),
                eq(decisionSubscriptions.organizationId, organizationId),
              ),
            )
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: "Failed to update subscription",
            operation: "updateSubscription",
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Subscription not found",
            entity: "DecisionSubscription",
            id: `${userId}/${organizationId}`,
          }),
        );
      }

      return result[0];
    });

  const getSubscription = (
    userId: string,
    organizationId: string,
  ): Effect.Effect<typeof decisionSubscriptions.$inferSelect | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .select()
          .from(decisionSubscriptions)
          .where(
            and(
              eq(decisionSubscriptions.userId, userId),
              eq(decisionSubscriptions.organizationId, organizationId),
            ),
          )
          .limit(1);
        return result[0] ?? null;
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch subscription",
          operation: "getSubscription",
          cause: error,
        }),
    });

  const searchDecisions = (
    organizationId: string,
    query: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError> =>
    getDecisions(organizationId, { search: query }, page, limit);

  const getDecisionEdits = (
    decisionId: string,
  ): Effect.Effect<(typeof decisionEdits.$inferSelect & { user: typeof users.$inferSelect })[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select({
            id: decisionEdits.id,
            decisionId: decisionEdits.decisionId,
            userId: decisionEdits.userId,
            fieldChanged: decisionEdits.fieldChanged,
            oldValue: decisionEdits.oldValue,
            newValue: decisionEdits.newValue,
            editedAt: decisionEdits.editedAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              emailVerified: users.emailVerified,
              createdAt: users.createdAt,
              updatedAt: users.updatedAt,
              role: users.role,
              banned: users.banned,
              banReason: users.banReason,
              banExpires: users.banExpires,
              twoFactorEnabled: users.twoFactorEnabled,
            },
          })
          .from(decisionEdits)
          .innerJoin(users, eq(decisionEdits.userId, users.id))
          .where(eq(decisionEdits.decisionId, decisionId))
          .orderBy(desc(decisionEdits.editedAt));
      },
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch decision edits",
          operation: "getDecisionEdits",
          cause: error,
        }),
    });

  return {
    getDecisions,
    getDecisionById,
    createDecision,
    updateDecision,
    deleteDecision,
    addParticipant,
    removeParticipant,
    getOrCreateTag,
    getTags,
    addTag,
    removeTag,
    createLink,
    deleteLink,
    supersedeDecision,
    getOrCreateSubscription,
    updateSubscription,
    getSubscription,
    searchDecisions,
    getDecisionEdits,
  } satisfies DecisionRepositoryService;
});

// =============================================================================
// Decision Repository Layer
// =============================================================================

export const DecisionRepositoryLive = Layer.effect(DecisionRepository, makeDecisionRepositoryService);

// =============================================================================
// Decision Repository Helper Functions
// =============================================================================

export const getDecisions = (
  organizationId: string,
  filters?: DecisionFilters,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.getDecisions(organizationId, filters, page, limit);
  });

export const getDecisionById = (
  id: string,
): Effect.Effect<DecisionWithDetails, DatabaseError | NotFoundError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.getDecisionById(id);
  });

export const createDecision = (
  data: CreateDecisionInput,
): Effect.Effect<typeof decisions.$inferSelect, DatabaseError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.createDecision(data);
  });

export const updateDecision = (
  id: string,
  data: UpdateDecisionInput,
  userId: string,
): Effect.Effect<typeof decisions.$inferSelect, DatabaseError | NotFoundError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.updateDecision(id, data, userId);
  });

export const deleteDecision = (
  id: string,
): Effect.Effect<void, DatabaseError | NotFoundError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.deleteDecision(id);
  });

export const searchDecisions = (
  organizationId: string,
  query: string,
  page?: number,
  limit?: number,
): Effect.Effect<PaginatedResponse<DecisionWithSummary>, DatabaseError, DecisionRepository> =>
  Effect.gen(function* () {
    const repo = yield* DecisionRepository;
    return yield* repo.searchDecisions(organizationId, query, page, limit);
  });
