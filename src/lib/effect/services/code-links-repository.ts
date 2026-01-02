/**
 * Code Links Repository Service using Effect-TS
 *
 * Provides type-safe database operations for GitHub connections and code links.
 * This enables bidirectional linking between videos and code artifacts.
 */

import { and, count, desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import {
  type CodeLink,
  type CodeLinkMetadata,
  type CodeLinkType,
  codeLinks,
  type GitHubConnection,
  type GitHubRepositoryInfo,
  githubConnections,
  users,
  videos,
} from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";
import { Database, type DrizzleDB } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface CreateGitHubConnectionInput {
  readonly organizationId: string;
  readonly connectedByUserId: string;
  readonly installationId?: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenExpiresAt?: Date;
  readonly repositories?: GitHubRepositoryInfo[];
  readonly scopes?: string;
}

export interface UpdateGitHubConnectionInput {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly tokenExpiresAt?: Date;
  readonly repositories?: GitHubRepositoryInfo[];
  readonly scopes?: string;
  readonly lastSyncAt?: Date;
}

export interface CreateCodeLinkInput {
  readonly videoId: string;
  readonly linkType: CodeLinkType;
  readonly githubRepo: string;
  readonly githubRef: string;
  readonly githubUrl?: string;
  readonly context?: string;
  readonly autoDetected?: boolean;
  readonly confidence?: number;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly metadata?: CodeLinkMetadata;
  readonly createdByUserId?: string;
}

export interface UpdateCodeLinkInput {
  readonly context?: string;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly metadata?: CodeLinkMetadata;
}

export interface CodeLinkWithVideo extends CodeLink {
  readonly video: {
    readonly id: string;
    readonly title: string;
    readonly thumbnailUrl: string | null;
    readonly duration: string;
    readonly organizationId: string;
  };
  readonly createdByUser?: {
    readonly id: string;
    readonly name: string;
    readonly image: string | null;
  } | null;
}

export interface GitHubConnectionWithUser extends GitHubConnection {
  readonly connectedByUser: {
    readonly id: string;
    readonly name: string | null;
    readonly image: string | null;
  };
}

export interface RepoContextSummary {
  readonly repo: string;
  readonly prCount: number;
  readonly issueCount: number;
  readonly commitCount: number;
  readonly fileCount: number;
  readonly totalLinks: number;
  readonly latestVideo?: {
    readonly id: string;
    readonly title: string;
    readonly createdAt: Date;
  };
}

// =============================================================================
// Code Links Repository Interface
// =============================================================================

export interface CodeLinksRepositoryService {
  // GitHub Connections
  readonly getGitHubConnection: (
    organizationId: string,
  ) => Effect.Effect<GitHubConnectionWithUser | undefined, DatabaseError>;

  readonly createGitHubConnection: (
    data: CreateGitHubConnectionInput,
  ) => Effect.Effect<GitHubConnection, DatabaseError>;

  readonly updateGitHubConnection: (
    id: string,
    data: UpdateGitHubConnectionInput,
  ) => Effect.Effect<GitHubConnection, DatabaseError | NotFoundError>;

  readonly deleteGitHubConnection: (organizationId: string) => Effect.Effect<void, DatabaseError>;

  readonly syncRepositories: (
    organizationId: string,
    repositories: GitHubRepositoryInfo[],
  ) => Effect.Effect<GitHubConnection, DatabaseError | NotFoundError>;

  // Code Links
  readonly getCodeLinks: (videoId: string) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;

  readonly getCodeLinksByRepo: (
    repo: string,
    options?: {
      type?: CodeLinkType;
      ref?: string;
      limit?: number;
      offset?: number;
    },
  ) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;

  readonly getCodeLink: (id: string) => Effect.Effect<CodeLinkWithVideo | undefined, DatabaseError>;

  readonly createCodeLink: (data: CreateCodeLinkInput) => Effect.Effect<CodeLink, DatabaseError>;

  readonly createCodeLinksBatch: (data: CreateCodeLinkInput[]) => Effect.Effect<CodeLink[], DatabaseError>;

  readonly updateCodeLink: (
    id: string,
    data: UpdateCodeLinkInput,
  ) => Effect.Effect<CodeLink, DatabaseError | NotFoundError>;

  readonly deleteCodeLink: (id: string) => Effect.Effect<void, DatabaseError>;

  readonly deleteCodeLinksByVideo: (videoId: string) => Effect.Effect<void, DatabaseError>;

  // Query helpers
  readonly getVideosByCodeArtifact: (
    repo: string,
    type: CodeLinkType,
    ref: string,
  ) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;

  readonly getRepoContextSummary: (repo: string) => Effect.Effect<RepoContextSummary, DatabaseError>;

  readonly searchCodeLinks: (
    query: string,
    options?: {
      organizationId?: string;
      type?: CodeLinkType;
      limit?: number;
    },
  ) => Effect.Effect<CodeLinkWithVideo[], DatabaseError>;
}

// =============================================================================
// Code Links Repository Tag
// =============================================================================

export class CodeLinksRepository extends Context.Tag("CodeLinksRepository")<
  CodeLinksRepository,
  CodeLinksRepositoryService
>() {}

// =============================================================================
// Code Links Repository Implementation
// =============================================================================

const makeCodeLinksRepository = Effect.gen(function* () {
  const database = yield* Database;

  const getDb = (): DrizzleDB => database.db;

  // GitHub Connections
  const getGitHubConnection = (
    organizationId: string,
  ): Effect.Effect<GitHubConnectionWithUser | undefined, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const result = await db
          .select({
            connection: githubConnections,
            user: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(githubConnections)
          .leftJoin(users, eq(githubConnections.connectedByUserId, users.id))
          .where(eq(githubConnections.organizationId, organizationId))
          .limit(1);

        if (result.length === 0) return undefined;

        const { connection, user } = result[0];
        return {
          ...connection,
          connectedByUser: user ?? { id: connection.connectedByUserId, name: null, image: null },
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get GitHub connection: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const createGitHubConnection = (data: CreateGitHubConnectionInput): Effect.Effect<GitHubConnection, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const [result] = await db
          .insert(githubConnections)
          .values({
            organizationId: data.organizationId,
            connectedByUserId: data.connectedByUserId,
            installationId: data.installationId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tokenExpiresAt: data.tokenExpiresAt,
            repositories: data.repositories,
            scopes: data.scopes,
          })
          .returning();
        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create GitHub connection: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const updateGitHubConnection = (
    id: string,
    data: UpdateGitHubConnectionInput,
  ): Effect.Effect<GitHubConnection, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const [result] = await db
          .update(githubConnections)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(githubConnections.id, id))
          .returning();

        if (!result) {
          throw new NotFoundError({ message: `GitHub connection not found: ${id}`, entity: "GitHubConnection", id });
        }

        return result;
      },
      catch: (error) => {
        if (error instanceof NotFoundError) return error;
        return new DatabaseError({
          message: `Failed to update GitHub connection: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      },
    });

  const deleteGitHubConnection = (organizationId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        await db.delete(githubConnections).where(eq(githubConnections.organizationId, organizationId));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete GitHub connection: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const syncRepositories = (
    organizationId: string,
    repositories: GitHubRepositoryInfo[],
  ): Effect.Effect<GitHubConnection, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const [result] = await db
          .update(githubConnections)
          .set({
            repositories,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(githubConnections.organizationId, organizationId))
          .returning();

        if (!result) {
          throw new NotFoundError({
            message: `GitHub connection not found for org: ${organizationId}`,
            entity: "GitHubConnection",
            id: organizationId,
          });
        }

        return result;
      },
      catch: (error) => {
        if (error instanceof NotFoundError) return error;
        return new DatabaseError({
          message: `Failed to sync repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      },
    });

  // Code Links
  const getCodeLinks = (videoId: string): Effect.Effect<CodeLinkWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const results = await db
          .select({
            codeLink: codeLinks,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            user: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdByUserId, users.id))
          .where(eq(codeLinks.videoId, videoId))
          .orderBy(desc(codeLinks.createdAt));

        return results.map(({ codeLink, video, user }) => ({
          ...codeLink,
          video,
          createdByUser: user,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get code links: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const getCodeLinksByRepo = (
    repo: string,
    options: {
      type?: CodeLinkType;
      ref?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Effect.Effect<CodeLinkWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const conditions = [eq(codeLinks.githubRepo, repo)];

        if (options.type) {
          conditions.push(eq(codeLinks.linkType, options.type));
        }
        if (options.ref) {
          conditions.push(eq(codeLinks.githubRef, options.ref));
        }

        const results = await db
          .select({
            codeLink: codeLinks,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            user: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdByUserId, users.id))
          .where(and(...conditions))
          .orderBy(desc(codeLinks.createdAt))
          .limit(options.limit || 50)
          .offset(options.offset || 0);

        return results.map(({ codeLink, video, user }) => ({
          ...codeLink,
          video,
          createdByUser: user,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get code links by repo: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const getCodeLink = (id: string): Effect.Effect<CodeLinkWithVideo | undefined, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const results = await db
          .select({
            codeLink: codeLinks,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            user: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdByUserId, users.id))
          .where(eq(codeLinks.id, id))
          .limit(1);

        if (results.length === 0) return undefined;

        const { codeLink, video, user } = results[0];
        return {
          ...codeLink,
          video,
          createdByUser: user,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get code link: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const createCodeLink = (data: CreateCodeLinkInput): Effect.Effect<CodeLink, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const [result] = await db
          .insert(codeLinks)
          .values({
            videoId: data.videoId,
            linkType: data.linkType,
            githubRepo: data.githubRepo,
            githubRef: data.githubRef,
            githubUrl: data.githubUrl,
            context: data.context,
            autoDetected: data.autoDetected ?? false,
            confidence: data.confidence,
            timestampStart: data.timestampStart,
            timestampEnd: data.timestampEnd,
            metadata: data.metadata,
            createdByUserId: data.createdByUserId,
          })
          .onConflictDoNothing()
          .returning();

        // If conflict occurred, fetch the existing record
        if (!result) {
          const existing = await db
            .select()
            .from(codeLinks)
            .where(
              and(
                eq(codeLinks.videoId, data.videoId),
                eq(codeLinks.linkType, data.linkType),
                eq(codeLinks.githubRepo, data.githubRepo),
                eq(codeLinks.githubRef, data.githubRef),
              ),
            )
            .limit(1);
          return existing[0];
        }

        return result;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create code link: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const createCodeLinksBatch = (data: CreateCodeLinkInput[]): Effect.Effect<CodeLink[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        if (data.length === 0) return [];

        const results = await db
          .insert(codeLinks)
          .values(
            data.map((d) => ({
              videoId: d.videoId,
              linkType: d.linkType,
              githubRepo: d.githubRepo,
              githubRef: d.githubRef,
              githubUrl: d.githubUrl,
              context: d.context,
              autoDetected: d.autoDetected ?? false,
              confidence: d.confidence,
              timestampStart: d.timestampStart,
              timestampEnd: d.timestampEnd,
              metadata: d.metadata,
              createdByUserId: d.createdByUserId,
            })),
          )
          .onConflictDoNothing()
          .returning();

        return results;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create code links batch: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const updateCodeLink = (
    id: string,
    data: UpdateCodeLinkInput,
  ): Effect.Effect<CodeLink, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const [result] = await db
          .update(codeLinks)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(codeLinks.id, id))
          .returning();

        if (!result) {
          throw new NotFoundError({ message: `Code link not found: ${id}`, entity: "CodeLink", id });
        }

        return result;
      },
      catch: (error) => {
        if (error instanceof NotFoundError) return error;
        return new DatabaseError({
          message: `Failed to update code link: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      },
    });

  const deleteCodeLink = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        await db.delete(codeLinks).where(eq(codeLinks.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete code link: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const deleteCodeLinksByVideo = (videoId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        await db.delete(codeLinks).where(eq(codeLinks.videoId, videoId));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete code links by video: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  // Query helpers
  const getVideosByCodeArtifact = (
    repo: string,
    type: CodeLinkType,
    ref: string,
  ): Effect.Effect<CodeLinkWithVideo[], DatabaseError> => getCodeLinksByRepo(repo, { type, ref });

  const getRepoContextSummary = (repo: string): Effect.Effect<RepoContextSummary, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();

        // Get counts by type
        const typeCounts = await db
          .select({
            linkType: codeLinks.linkType,
            count: count(),
          })
          .from(codeLinks)
          .where(eq(codeLinks.githubRepo, repo))
          .groupBy(codeLinks.linkType);

        // Get latest video
        const latestVideoResult = await db
          .select({
            id: videos.id,
            title: videos.title,
            createdAt: videos.createdAt,
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .where(eq(codeLinks.githubRepo, repo))
          .orderBy(desc(videos.createdAt))
          .limit(1);

        const countMap: Record<string, number> = {};
        let totalLinks = 0;
        for (const { linkType, count: c } of typeCounts) {
          countMap[linkType] = c;
          totalLinks += c;
        }

        return {
          repo,
          prCount: countMap.pr || 0,
          issueCount: countMap.issue || 0,
          commitCount: countMap.commit || 0,
          fileCount: (countMap.file || 0) + (countMap.directory || 0),
          totalLinks,
          latestVideo: latestVideoResult[0],
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get repo context summary: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  const searchCodeLinks = (
    query: string,
    options: {
      organizationId?: string;
      type?: CodeLinkType;
      limit?: number;
    } = {},
  ): Effect.Effect<CodeLinkWithVideo[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const db = getDb();
        const searchPattern = `%${query}%`;

        const conditions = [
          sql`(${codeLinks.githubRepo} ILIKE ${searchPattern} OR ${codeLinks.githubRef} ILIKE ${searchPattern} OR ${codeLinks.context} ILIKE ${searchPattern})`,
        ];

        if (options.type) {
          conditions.push(eq(codeLinks.linkType, options.type));
        }
        if (options.organizationId) {
          conditions.push(eq(videos.organizationId, options.organizationId));
        }

        const results = await db
          .select({
            codeLink: codeLinks,
            video: {
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              organizationId: videos.organizationId,
            },
            user: {
              id: users.id,
              name: users.name,
              image: users.image,
            },
          })
          .from(codeLinks)
          .innerJoin(videos, eq(codeLinks.videoId, videos.id))
          .leftJoin(users, eq(codeLinks.createdByUserId, users.id))
          .where(and(...conditions))
          .orderBy(desc(codeLinks.createdAt))
          .limit(options.limit || 20);

        return results.map(({ codeLink, video, user }) => ({
          ...codeLink,
          video,
          createdByUser: user,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search code links: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
    });

  return {
    // GitHub Connections
    getGitHubConnection,
    createGitHubConnection,
    updateGitHubConnection,
    deleteGitHubConnection,
    syncRepositories,
    // Code Links
    getCodeLinks,
    getCodeLinksByRepo,
    getCodeLink,
    createCodeLink,
    createCodeLinksBatch,
    updateCodeLink,
    deleteCodeLink,
    deleteCodeLinksByVideo,
    // Query helpers
    getVideosByCodeArtifact,
    getRepoContextSummary,
    searchCodeLinks,
  } satisfies CodeLinksRepositoryService;
});

// =============================================================================
// Code Links Repository Layer
// =============================================================================

export const CodeLinksRepositoryLive = Layer.effect(CodeLinksRepository, makeCodeLinksRepository);

// =============================================================================
// Helper Functions
// =============================================================================

export const getGitHubConnection = (
  organizationId: string,
): Effect.Effect<GitHubConnectionWithUser | undefined, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getGitHubConnection(organizationId);
  });

export const createGitHubConnection = (
  data: CreateGitHubConnectionInput,
): Effect.Effect<GitHubConnection, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.createGitHubConnection(data);
  });

export const updateGitHubConnection = (
  id: string,
  data: UpdateGitHubConnectionInput,
): Effect.Effect<GitHubConnection, DatabaseError | NotFoundError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.updateGitHubConnection(id, data);
  });

export const deleteGitHubConnection = (
  organizationId: string,
): Effect.Effect<void, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.deleteGitHubConnection(organizationId);
  });

export const syncGitHubRepositories = (
  organizationId: string,
  repositories: GitHubRepositoryInfo[],
): Effect.Effect<GitHubConnection, DatabaseError | NotFoundError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.syncRepositories(organizationId, repositories);
  });

export const getCodeLinks = (videoId: string): Effect.Effect<CodeLinkWithVideo[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getCodeLinks(videoId);
  });

export const getCodeLinksByRepo = (
  repoName: string,
  options?: {
    type?: CodeLinkType;
    ref?: string;
    limit?: number;
    offset?: number;
  },
): Effect.Effect<CodeLinkWithVideo[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getCodeLinksByRepo(repoName, options);
  });

export const getCodeLink = (
  id: string,
): Effect.Effect<CodeLinkWithVideo | undefined, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.getCodeLink(id);
  });

export const createCodeLink = (
  data: CreateCodeLinkInput,
): Effect.Effect<CodeLink, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.createCodeLink(data);
  });

export const createCodeLinksBatch = (
  data: CreateCodeLinkInput[],
): Effect.Effect<CodeLink[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.createCodeLinksBatch(data);
  });

export const updateCodeLink = (
  id: string,
  data: UpdateCodeLinkInput,
): Effect.Effect<CodeLink, DatabaseError | NotFoundError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.updateCodeLink(id, data);
  });

export const deleteCodeLink = (id: string): Effect.Effect<void, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.deleteCodeLink(id);
  });

export const getVideosByCodeArtifact = (
  repo: string,
  type: CodeLinkType,
  ref: string,
): Effect.Effect<CodeLinkWithVideo[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repository = yield* CodeLinksRepository;
    return yield* repository.getVideosByCodeArtifact(repo, type, ref);
  });

export const getRepoContextSummary = (
  repo: string,
): Effect.Effect<RepoContextSummary, DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repository = yield* CodeLinksRepository;
    return yield* repository.getRepoContextSummary(repo);
  });

export const searchCodeLinks = (
  query: string,
  options?: {
    organizationId?: string;
    type?: CodeLinkType;
    limit?: number;
  },
): Effect.Effect<CodeLinkWithVideo[], DatabaseError, CodeLinksRepository> =>
  Effect.gen(function* () {
    const repo = yield* CodeLinksRepository;
    return yield* repo.searchCodeLinks(query, options);
  });
