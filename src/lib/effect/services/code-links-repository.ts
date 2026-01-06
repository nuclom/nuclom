/**
 * Code Links Repository Service using Effect-TS
 *
 * Provides type-safe database operations for code links - bidirectional links
 * between videos and GitHub code artifacts (PRs, issues, commits, files).
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { type CodeLinkType, codeLinks, users, videos } from '@/lib/db/schema';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateCodeLinkInput {
  readonly videoId: string;
  readonly linkType: CodeLinkType;
  readonly githubRepo: string;
  readonly githubRef: string;
  readonly githubUrl?: string;
  readonly context?: string;
  readonly autoDetected?: boolean;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly createdById?: string;
}

export interface UpdateCodeLinkInput {
  readonly context?: string;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
}

export interface CodeLinkWithVideo {
  readonly id: string;
  readonly videoId: string;
  readonly linkType: CodeLinkType;
  readonly githubRepo: string;
  readonly githubRef: string;
  readonly githubUrl: string | null;
  readonly context: string | null;
  readonly autoDetected: boolean;
  readonly timestampStart: number | null;
  readonly timestampEnd: number | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
    readonly organizationId: string;
  };
  readonly createdBy: {
    readonly id: string;
    readonly name: string;
    readonly image: string | null;
  } | null;
}

export interface CodeLinksByArtifact {
  readonly links: CodeLinkWithVideo[];
  readonly totalCount: number;
}

// =============================================================================
// Code Links Repository Interface
// =============================================================================

export interface CodeLinksRepositoryService {
  /**
   * Get all code links for a video
   */
  readonly getCodeLinksForVideo: (videoId: string) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;

  /**
   * Get code links by GitHub artifact (repo + type + ref)
   */
  readonly getCodeLinksByArtifact: (
    githubRepo: string,
    linkType: CodeLinkType,
    githubRef: string,
  ) => Effect.Effect<CodeLinksByArtifact, DatabaseError>;

  /**
   * Get all code links for a repository
   */
  readonly getCodeLinksForRepo: (
    githubRepo: string,
    limit?: number,
    offset?: number,
  ) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;

  /**
   * Get a specific code link by ID
   */
  readonly getCodeLink: (id: string) => Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Create a new code link
   */
  readonly createCodeLink: (data: CreateCodeLinkInput) => Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError>;

  /**
   * Create multiple code links at once
   */
  readonly createCodeLinks: (
    data: CreateCodeLinkInput[],
  ) => Effect.Effect<(typeof codeLinks.$inferSelect)[], DatabaseError>;

  /**
   * Update a code link
   */
  readonly updateCodeLink: (
    id: string,
    data: UpdateCodeLinkInput,
  ) => Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError | NotFoundError>;

  /**
   * Delete a code link
   */
  readonly deleteCodeLink: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Delete all auto-detected code links for a video
   */
  readonly deleteAutoDetectedLinks: (videoId: string) => Effect.Effect<number, DatabaseError>;

  /**
   * Get repository summary (counts of links by type)
   */
  readonly getRepoSummary: (
    githubRepo: string,
  ) => Effect.Effect<{ linkType: CodeLinkType; count: number }[], DatabaseError>;

  /**
   * Search for videos linked to any artifact in a repository
   */
  readonly searchVideosForRepo: (
    githubRepo: string,
    query?: string,
    limit?: number,
  ) => Effect.Effect<
    Array<{
      videoId: string;
      videoTitle: string;
      thumbnailUrl: string | null;
      linkCount: number;
      latestLinkAt: Date;
    }>,
    DatabaseError
  >;
}

// =============================================================================
// Code Links Repository Tag
// =============================================================================

export class CodeLinksRepository extends Context.Tag('CodeLinksRepository')<
  CodeLinksRepository,
  CodeLinksRepositoryService
>() {}

// =============================================================================
// Code Links Repository Implementation
// =============================================================================

const makeCodeLinksRepositoryService = Effect.gen(function* () {
  const { db } = yield* Database;

  const getCodeLinksForVideo = (videoId: string): Effect.Effect<CodeLinkWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: codeLinks.id,
            videoId: codeLinks.videoId,
            linkType: codeLinks.linkType,
            githubRepo: codeLinks.githubRepo,
            githubRef: codeLinks.githubRef,
            githubUrl: codeLinks.githubUrl,
            context: codeLinks.context,
            autoDetected: codeLinks.autoDetected,
            timestampStart: codeLinks.timestampStart,
            timestampEnd: codeLinks.timestampEnd,
            createdById: codeLinks.createdById,
            createdAt: codeLinks.createdAt,
            updatedAt: codeLinks.updatedAt,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            createdBy: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdById, users.id))
          .where(eq(codeLinks.videoId, videoId))
          .orderBy(desc(codeLinks.createdAt));

        return results as CodeLinkWithVideo[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch code links for video',
          operation: 'getCodeLinksForVideo',
          cause: error,
        }),
    });

  const getCodeLinksByArtifact = (
    githubRepo: string,
    linkType: CodeLinkType,
    githubRef: string,
  ): Effect.Effect<CodeLinksByArtifact, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: codeLinks.id,
            videoId: codeLinks.videoId,
            linkType: codeLinks.linkType,
            githubRepo: codeLinks.githubRepo,
            githubRef: codeLinks.githubRef,
            githubUrl: codeLinks.githubUrl,
            context: codeLinks.context,
            autoDetected: codeLinks.autoDetected,
            timestampStart: codeLinks.timestampStart,
            timestampEnd: codeLinks.timestampEnd,
            createdById: codeLinks.createdById,
            createdAt: codeLinks.createdAt,
            updatedAt: codeLinks.updatedAt,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            createdBy: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdById, users.id))
          .where(
            and(
              eq(codeLinks.githubRepo, githubRepo),
              eq(codeLinks.linkType, linkType),
              eq(codeLinks.githubRef, githubRef),
            ),
          )
          .orderBy(desc(codeLinks.createdAt));

        return {
          links: results as CodeLinkWithVideo[],
          totalCount: results.length,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch code links by artifact',
          operation: 'getCodeLinksByArtifact',
          cause: error,
        }),
    });

  const getCodeLinksForRepo = (
    githubRepo: string,
    limit = 50,
    offset = 0,
  ): Effect.Effect<CodeLinkWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            id: codeLinks.id,
            videoId: codeLinks.videoId,
            linkType: codeLinks.linkType,
            githubRepo: codeLinks.githubRepo,
            githubRef: codeLinks.githubRef,
            githubUrl: codeLinks.githubUrl,
            context: codeLinks.context,
            autoDetected: codeLinks.autoDetected,
            timestampStart: codeLinks.timestampStart,
            timestampEnd: codeLinks.timestampEnd,
            createdById: codeLinks.createdById,
            createdAt: codeLinks.createdAt,
            updatedAt: codeLinks.updatedAt,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            createdBy: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdById, users.id))
          .where(eq(codeLinks.githubRepo, githubRepo))
          .orderBy(desc(codeLinks.createdAt))
          .limit(limit)
          .offset(offset);

        return results as CodeLinkWithVideo[];
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch code links for repository',
          operation: 'getCodeLinksForRepo',
          cause: error,
        }),
    });

  const getCodeLink = (id: string): Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(codeLinks).where(eq(codeLinks.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch code link',
            operation: 'getCodeLink',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Code link not found',
            entity: 'CodeLink',
            id,
          }),
        );
      }

      return result[0];
    });

  const createCodeLink = (data: CreateCodeLinkInput): Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [newLink] = await db.insert(codeLinks).values(data).returning();
        return newLink;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create code link',
          operation: 'createCodeLink',
          cause: error,
        }),
    });

  const createCodeLinks = (
    data: CreateCodeLinkInput[],
  ): Effect.Effect<(typeof codeLinks.$inferSelect)[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        const newLinks = await db.insert(codeLinks).values(data).returning();
        return newLinks;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create code links',
          operation: 'createCodeLinks',
          cause: error,
        }),
    });

  const updateCodeLink = (
    id: string,
    data: UpdateCodeLinkInput,
  ): Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(codeLinks)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(codeLinks.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update code link',
            operation: 'updateCodeLink',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Code link not found',
            entity: 'CodeLink',
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteCodeLink = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(codeLinks).where(eq(codeLinks.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete code link',
            operation: 'deleteCodeLink',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Code link not found',
            entity: 'CodeLink',
            id,
          }),
        );
      }
    });

  const deleteAutoDetectedLinks = (videoId: string): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await db
          .delete(codeLinks)
          .where(and(eq(codeLinks.videoId, videoId), eq(codeLinks.autoDetected, true)))
          .returning();
        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete auto-detected links',
          operation: 'deleteAutoDetectedLinks',
          cause: error,
        }),
    });

  const getRepoSummary = (
    githubRepo: string,
  ): Effect.Effect<{ linkType: CodeLinkType; count: number }[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            linkType: codeLinks.linkType,
            count: sql<number>`count(*)::int`,
          })
          .from(codeLinks)
          .where(eq(codeLinks.githubRepo, githubRepo))
          .groupBy(codeLinks.linkType);

        return results;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get repository summary',
          operation: 'getRepoSummary',
          cause: error,
        }),
    });

  const searchVideosForRepo = (
    githubRepo: string,
    _query?: string,
    limit = 20,
  ): Effect.Effect<
    Array<{
      videoId: string;
      videoTitle: string;
      thumbnailUrl: string | null;
      linkCount: number;
      latestLinkAt: Date;
    }>,
    DatabaseError
  > =>
    Effect.tryPromise({
      try: async () => {
        const results = await db
          .select({
            videoId: videos.id,
            videoTitle: videos.title,
            thumbnailUrl: videos.thumbnailUrl,
            linkCount: sql<number>`count(${codeLinks.id})::int`,
            latestLinkAt: sql<Date>`max(${codeLinks.createdAt})`,
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .where(eq(codeLinks.githubRepo, githubRepo))
          .groupBy(videos.id, videos.title, videos.thumbnailUrl)
          .orderBy(sql`max(${codeLinks.createdAt}) desc`)
          .limit(limit);

        return results;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to search videos for repository',
          operation: 'searchVideosForRepo',
          cause: error,
        }),
    });

  return {
    getCodeLinksForVideo,
    getCodeLinksByArtifact,
    getCodeLinksForRepo,
    getCodeLink,
    createCodeLink,
    createCodeLinks,
    updateCodeLink,
    deleteCodeLink,
    deleteAutoDetectedLinks,
    getRepoSummary,
    searchVideosForRepo,
  } satisfies CodeLinksRepositoryService;
});

// =============================================================================
// Code Links Repository Layer
// =============================================================================

export const CodeLinksRepositoryLive = Layer.effect(CodeLinksRepository, makeCodeLinksRepositoryService);

// =============================================================================
// Code Links Repository Helper Functions
// =============================================================================

export const getCodeLinksForVideo = (
  videoId: string,
): Effect.Effect<CodeLinkWithVideo[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getCodeLinksForVideo(videoId);
  });

export const getCodeLinksByArtifact = (
  githubRepo: string,
  linkType: CodeLinkType,
  githubRef: string,
): Effect.Effect<CodeLinksByArtifact, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getCodeLinksByArtifact(githubRepo, linkType, githubRef);
  });

export const createCodeLink = (
  data: CreateCodeLinkInput,
): Effect.Effect<typeof codeLinks.$inferSelect, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.createCodeLink(data);
  });

export const deleteCodeLink = (id: string): Effect.Effect<void, DatabaseError | NotFoundError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.deleteCodeLink(id);
  });
