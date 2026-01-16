/**
 * Knowledge Graph Repository using Effect-TS
 *
 * Provides database operations for the knowledge graph including
 * decisions, participants, nodes, edges, and links.
 */

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { normalizeOne } from '../../db/relations';
import type {
  Decision,
  DecisionLink,
  DecisionParticipant,
  DecisionStatus,
  DecisionType,
  KnowledgeEdge,
  KnowledgeNode,
  KnowledgeNodeType,
  NewDecision,
  NewDecisionLink,
  NewDecisionParticipant,
  NewKnowledgeEdge,
  NewKnowledgeNode,
} from '../../db/schema';
import { decisionLinks, decisionParticipants, decisions, knowledgeEdges, knowledgeNodes } from '../../db/schema';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface DecisionWithRelations extends Decision {
  video?: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
  };
  participants?: Array<
    DecisionParticipant & {
      user?: { id: string; name: string; image: string | null } | null;
    }
  >;
  links?: DecisionLink[];
}

export interface DecisionQueryOptions {
  organizationId: string;
  videoId?: string;
  status?: DecisionStatus;
  decisionType?: DecisionType;
  topic?: string;
  personId?: string;
  search?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface KnowledgeNodeWithEdges extends KnowledgeNode {
  outgoingEdges?: Array<
    KnowledgeEdge & {
      targetNode?: KnowledgeNode;
    }
  >;
  incomingEdges?: Array<
    KnowledgeEdge & {
      sourceNode?: KnowledgeNode;
    }
  >;
}

export interface GraphQueryOptions {
  organizationId: string;
  centerId?: string;
  centerType?: KnowledgeNodeType;
  depth?: number;
  relationshipTypes?: string[];
  limit?: number;
}

export interface DecisionTimelineItem {
  id: string;
  summary: string;
  decisionType: DecisionType;
  status: DecisionStatus;
  timestampStart: number | null;
  confidence: number | null;
  createdAt: Date;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
  };
  participantCount: number;
  tags: string[];
}

function normalizeDecisionRelations(
  decision: Decision & {
    video?: DecisionWithRelations['video'] | DecisionWithRelations['video'][];
    participants?: DecisionWithRelations['participants'];
    links?: DecisionWithRelations['links'];
  },
): DecisionWithRelations {
  return {
    ...decision,
    confidence: decision.confidence ?? null,
    video: normalizeOne(decision.video) ?? undefined,
    participants: decision.participants?.map((participant) => ({
      ...participant,
      user: normalizeOne(participant.user),
    })),
    links: decision.links ?? [],
  };
}

function normalizeKnowledgeNodeEdges(node: KnowledgeNodeWithEdges): KnowledgeNodeWithEdges {
  return {
    ...node,
    outgoingEdges: node.outgoingEdges?.map((edge) => {
      const targetNode = normalizeOne(edge.targetNode);

      return targetNode ? { ...edge, targetNode } : { ...edge };
    }),
    incomingEdges: node.incomingEdges?.map((edge) => {
      const sourceNode = normalizeOne(edge.sourceNode);

      return sourceNode ? { ...edge, sourceNode } : { ...edge };
    }),
  };
}

// =============================================================================
// Service Interface
// =============================================================================

export interface KnowledgeGraphRepositoryInterface {
  // Decision CRUD
  readonly createDecision: (data: NewDecision) => Effect.Effect<Decision, DatabaseError>;
  readonly getDecision: (id: string) => Effect.Effect<DecisionWithRelations, DatabaseError | NotFoundError>;
  readonly updateDecision: (
    id: string,
    data: Partial<NewDecision>,
  ) => Effect.Effect<Decision, DatabaseError | NotFoundError>;
  readonly deleteDecision: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly listDecisions: (options: DecisionQueryOptions) => Effect.Effect<DecisionWithRelations[], DatabaseError>;

  // Decision Participants
  readonly addParticipant: (data: NewDecisionParticipant) => Effect.Effect<DecisionParticipant, DatabaseError>;
  readonly addParticipants: (data: NewDecisionParticipant[]) => Effect.Effect<DecisionParticipant[], DatabaseError>;
  readonly removeParticipant: (decisionId: string, participantId: string) => Effect.Effect<void, DatabaseError>;

  // Decision Links
  readonly addLink: (data: NewDecisionLink) => Effect.Effect<DecisionLink, DatabaseError>;
  readonly addLinks: (data: NewDecisionLink[]) => Effect.Effect<DecisionLink[], DatabaseError>;
  readonly removeLink: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly getLinksByEntity: (
    entityType: string,
    entityId: string,
  ) => Effect.Effect<(DecisionLink & { decision: Decision })[], DatabaseError>;

  // Knowledge Nodes
  readonly createNode: (data: NewKnowledgeNode) => Effect.Effect<KnowledgeNode, DatabaseError>;
  readonly getNode: (id: string) => Effect.Effect<KnowledgeNodeWithEdges, DatabaseError | NotFoundError>;
  readonly getNodeByExternalId: (
    organizationId: string,
    externalId: string,
  ) => Effect.Effect<KnowledgeNode | null, DatabaseError>;
  readonly upsertNode: (data: NewKnowledgeNode) => Effect.Effect<KnowledgeNode, DatabaseError>;
  readonly listNodes: (
    organizationId: string,
    type?: KnowledgeNodeType,
    limit?: number,
  ) => Effect.Effect<KnowledgeNode[], DatabaseError>;

  // Knowledge Edges
  readonly createEdge: (data: NewKnowledgeEdge) => Effect.Effect<KnowledgeEdge, DatabaseError>;
  readonly createEdges: (data: NewKnowledgeEdge[]) => Effect.Effect<KnowledgeEdge[], DatabaseError>;
  readonly deleteEdge: (id: string) => Effect.Effect<void, DatabaseError>;
  readonly getEdgesBetween: (sourceId: string, targetId: string) => Effect.Effect<KnowledgeEdge[], DatabaseError>;

  // Graph Queries
  readonly getGraph: (
    options: GraphQueryOptions,
  ) => Effect.Effect<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }, DatabaseError>;

  // Timeline Queries
  readonly getDecisionTimeline: (
    organizationId: string,
    options?: {
      topic?: string;
      personId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    },
  ) => Effect.Effect<DecisionTimelineItem[], DatabaseError>;

  // Context Queries
  readonly getDecisionContext: (
    organizationId: string,
    entityType: string,
    entityId: string,
  ) => Effect.Effect<DecisionWithRelations[], DatabaseError>;

  // Bulk Operations
  readonly saveDecisionsFromVideo: (
    videoId: string,
    organizationId: string,
    extractedDecisions: Array<{
      summary: string;
      context?: string;
      reasoning?: string;
      timestampStart: number;
      timestampEnd?: number;
      decisionType: DecisionType;
      status: DecisionStatus;
      confidence: number;
      tags: string[];
      participants: Array<{
        name: string;
        role: 'decider' | 'participant' | 'mentioned';
        attributedText?: string;
      }>;
      externalRefs?: Array<{
        type: string;
        id: string;
        url?: string;
      }>;
    }>,
  ) => Effect.Effect<Decision[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class KnowledgeGraphRepository extends Context.Tag('KnowledgeGraphRepository')<
  KnowledgeGraphRepository,
  KnowledgeGraphRepositoryInterface
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeKnowledgeGraphRepository = Effect.gen(function* () {
  const database = yield* Database;
  const db = database.db;

  // Decision CRUD
  const createDecision = (data: NewDecision): Effect.Effect<Decision, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [decision] = await db.insert(decisions).values(data).returning();
        return decision;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create decision',
          cause: error,
        }),
    });

  const getDecision = (id: string): Effect.Effect<DecisionWithRelations, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const decision = await db.query.decisions.findFirst({
          where: eq(decisions.id, id),
          with: {
            video: {
              columns: { id: true, title: true, thumbnailUrl: true },
            },
            participants: {
              with: {
                user: {
                  columns: { id: true, name: true, image: true },
                },
              },
            },
            links: true,
          },
        });
        return decision;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get decision',
          cause: error,
        }),
    }).pipe(
      Effect.flatMap((decision) =>
        decision
          ? Effect.succeed(normalizeDecisionRelations(decision))
          : Effect.fail(new NotFoundError({ message: `Decision ${id} not found`, entity: 'Decision', id })),
      ),
    );

  const updateDecision = (
    id: string,
    data: Partial<NewDecision>,
  ): Effect.Effect<Decision, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const [updated] = await db
          .update(decisions)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(decisions.id, id))
          .returning();
        return updated;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to update decision',
          cause: error,
        }),
    }).pipe(
      Effect.flatMap((decision) =>
        decision
          ? Effect.succeed(decision)
          : Effect.fail(new NotFoundError({ message: `Decision ${id} not found`, entity: 'Decision', id })),
      ),
    );

  const deleteDecision = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(decisions).where(eq(decisions.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete decision',
          cause: error,
        }),
    });

  const listDecisions = (options: DecisionQueryOptions): Effect.Effect<DecisionWithRelations[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(decisions.organizationId, options.organizationId)];

        if (options.videoId) {
          conditions.push(eq(decisions.videoId, options.videoId));
        }
        if (options.status) {
          conditions.push(eq(decisions.status, options.status));
        }
        if (options.decisionType) {
          conditions.push(eq(decisions.decisionType, options.decisionType));
        }
        if (options.minConfidence !== undefined) {
          conditions.push(sql`${decisions.confidence} >= ${options.minConfidence}`);
        }
        if (options.search) {
          conditions.push(
            or(ilike(decisions.summary, `%${options.search}%`), ilike(decisions.context, `%${options.search}%`)) ??
              sql`true`,
          );
        }
        if (options.topic) {
          conditions.push(sql`${decisions.tags} ? ${options.topic}`);
        }

        const results = await db.query.decisions.findMany({
          where: and(...conditions),
          with: {
            video: {
              columns: { id: true, title: true, thumbnailUrl: true },
            },
            participants: {
              with: {
                user: {
                  columns: { id: true, name: true, image: true },
                },
              },
            },
            links: true,
          },
          orderBy: desc(decisions.createdAt),
          limit: options.limit ?? 50,
          offset: options.offset ?? 0,
        });

        const normalizedResults = results.map((decision) => normalizeDecisionRelations(decision));

        // Filter by person if specified
        if (options.personId) {
          return normalizedResults.filter((d) => d.participants?.some((p) => p.userId === options.personId));
        }

        return normalizedResults;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to list decisions',
          cause: error,
        }),
    });

  // Decision Participants
  const addParticipant = (data: NewDecisionParticipant): Effect.Effect<DecisionParticipant, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [participant] = await db.insert(decisionParticipants).values(data).returning();
        return participant;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add participant',
          cause: error,
        }),
    });

  const addParticipants = (data: NewDecisionParticipant[]): Effect.Effect<DecisionParticipant[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        const participants = await db.insert(decisionParticipants).values(data).returning();
        return participants;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add participants',
          cause: error,
        }),
    });

  const removeParticipant = (decisionId: string, participantId: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .delete(decisionParticipants)
          .where(and(eq(decisionParticipants.decisionId, decisionId), eq(decisionParticipants.id, participantId)));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to remove participant',
          cause: error,
        }),
    });

  // Decision Links
  const addLink = (data: NewDecisionLink): Effect.Effect<DecisionLink, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [link] = await db.insert(decisionLinks).values(data).returning();
        return link;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add link',
          cause: error,
        }),
    });

  const addLinks = (data: NewDecisionLink[]): Effect.Effect<DecisionLink[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        const links = await db.insert(decisionLinks).values(data).returning();
        return links;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to add links',
          cause: error,
        }),
    });

  const removeLink = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(decisionLinks).where(eq(decisionLinks.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to remove link',
          cause: error,
        }),
    });

  const getLinksByEntity = (
    entityType: string,
    entityId: string,
  ): Effect.Effect<(DecisionLink & { decision: Decision })[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const links = await db.query.decisionLinks.findMany({
          where: and(eq(decisionLinks.entityType, entityType), eq(decisionLinks.entityId, entityId)),
          with: {
            decision: true,
          },
        });
        return links
          .map((link) => ({
            ...link,
            decision: normalizeOne(link.decision),
          }))
          .filter((link): link is DecisionLink & { decision: Decision } => !!link.decision);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get links by entity',
          cause: error,
        }),
    });

  // Knowledge Nodes
  const createNode = (data: NewKnowledgeNode): Effect.Effect<KnowledgeNode, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [node] = await db.insert(knowledgeNodes).values(data).returning();
        return node;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create knowledge node',
          cause: error,
        }),
    });

  const getNode = (id: string): Effect.Effect<KnowledgeNodeWithEdges, DatabaseError | NotFoundError> =>
    Effect.tryPromise({
      try: async () => {
        const node = await db.query.knowledgeNodes.findFirst({
          where: eq(knowledgeNodes.id, id),
          with: {
            outgoingEdges: {
              with: {
                targetNode: true,
              },
            },
            incomingEdges: {
              with: {
                sourceNode: true,
              },
            },
          },
        });
        return node;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get knowledge node',
          cause: error,
        }),
    }).pipe(
      Effect.flatMap((node) =>
        node
          ? Effect.succeed(normalizeKnowledgeNodeEdges(node))
          : Effect.fail(new NotFoundError({ message: `Node ${id} not found`, entity: 'KnowledgeNode', id })),
      ),
    );

  const getNodeByExternalId = (
    organizationId: string,
    externalId: string,
  ): Effect.Effect<KnowledgeNode | null, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const node = await db.query.knowledgeNodes.findFirst({
          where: and(eq(knowledgeNodes.organizationId, organizationId), eq(knowledgeNodes.externalId, externalId)),
        });
        return node ?? null;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get node by external ID',
          cause: error,
        }),
    });

  const upsertNode = (data: NewKnowledgeNode): Effect.Effect<KnowledgeNode, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.externalId) {
          const existing = await db.query.knowledgeNodes.findFirst({
            where: and(
              eq(knowledgeNodes.organizationId, data.organizationId),
              eq(knowledgeNodes.externalId, data.externalId),
            ),
          });
          if (existing) {
            const [updated] = await db
              .update(knowledgeNodes)
              .set({ ...data, updatedAt: new Date() })
              .where(eq(knowledgeNodes.id, existing.id))
              .returning();
            return updated;
          }
        }
        const [node] = await db.insert(knowledgeNodes).values(data).returning();
        return node;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to upsert knowledge node',
          cause: error,
        }),
    });

  const listNodes = (
    organizationId: string,
    type?: KnowledgeNodeType,
    limit?: number,
  ): Effect.Effect<KnowledgeNode[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(knowledgeNodes.organizationId, organizationId)];
        if (type) {
          conditions.push(eq(knowledgeNodes.type, type));
        }
        return await db.query.knowledgeNodes.findMany({
          where: and(...conditions),
          orderBy: desc(knowledgeNodes.createdAt),
          limit: limit ?? 100,
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to list knowledge nodes',
          cause: error,
        }),
    });

  // Knowledge Edges
  const createEdge = (data: NewKnowledgeEdge): Effect.Effect<KnowledgeEdge, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [edge] = await db.insert(knowledgeEdges).values(data).returning();
        return edge;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create knowledge edge',
          cause: error,
        }),
    });

  const createEdges = (data: NewKnowledgeEdge[]): Effect.Effect<KnowledgeEdge[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (data.length === 0) return [];
        const edges = await db.insert(knowledgeEdges).values(data).onConflictDoNothing().returning();
        return edges;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create knowledge edges',
          cause: error,
        }),
    });

  const deleteEdge = (id: string): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, id));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to delete knowledge edge',
          cause: error,
        }),
    });

  const getEdgesBetween = (sourceId: string, targetId: string): Effect.Effect<KnowledgeEdge[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db.query.knowledgeEdges.findMany({
          where: and(eq(knowledgeEdges.sourceNodeId, sourceId), eq(knowledgeEdges.targetNodeId, targetId)),
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get edges between nodes',
          cause: error,
        }),
    });

  // Graph Queries
  const getGraph = (
    options: GraphQueryOptions,
  ): Effect.Effect<{ nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Get all nodes for the organization
        const conditions = [eq(knowledgeNodes.organizationId, options.organizationId)];
        if (options.centerType) {
          conditions.push(eq(knowledgeNodes.type, options.centerType));
        }

        const allNodes = await db.query.knowledgeNodes.findMany({
          where: and(...conditions),
          limit: options.limit ?? 200,
        });

        if (allNodes.length === 0) {
          return { nodes: [], edges: [] };
        }

        const nodeIds = allNodes.map((n) => n.id);

        // Get all edges between these nodes
        const allEdges = await db.query.knowledgeEdges.findMany({
          where: and(
            inArray(knowledgeEdges.sourceNodeId, nodeIds),
            inArray(knowledgeEdges.targetNodeId, nodeIds),
            options.relationshipTypes && options.relationshipTypes.length > 0
              ? inArray(knowledgeEdges.relationship, options.relationshipTypes)
              : sql`true`,
          ),
        });

        return { nodes: allNodes, edges: allEdges };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get knowledge graph',
          cause: error,
        }),
    });

  // Timeline Queries
  const getDecisionTimeline = (
    organizationId: string,
    options?: {
      topic?: string;
      personId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    },
  ): Effect.Effect<DecisionTimelineItem[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(decisions.organizationId, organizationId)];

        if (options?.topic) {
          conditions.push(sql`${decisions.tags} ? ${options.topic}`);
        }
        if (options?.from) {
          conditions.push(sql`${decisions.createdAt} >= ${options.from}`);
        }
        if (options?.to) {
          conditions.push(sql`${decisions.createdAt} <= ${options.to}`);
        }

        const results = await db.query.decisions.findMany({
          where: and(...conditions),
          with: {
            video: {
              columns: { id: true, title: true, thumbnailUrl: true },
            },
            participants: true,
          },
          orderBy: desc(decisions.createdAt),
          limit: options?.limit ?? 50,
          offset: options?.offset ?? 0,
        });

        // Filter by person if specified
        let filtered = results;
        if (options?.personId) {
          filtered = results.filter((d) => d.participants?.some((p) => p.userId === options.personId));
        }

        return filtered
          .map((decision) => {
            const video = normalizeOne(decision.video);

            if (!video) {
              return null;
            }

            return {
              id: decision.id,
              summary: decision.summary,
              decisionType: decision.decisionType,
              status: decision.status,
              timestampStart: decision.timestampStart,
              confidence: decision.confidence ?? null,
              createdAt: decision.createdAt,
              video,
              participantCount: decision.participants?.length ?? 0,
              tags: decision.tags ?? [],
            };
          })
          .filter((item): item is DecisionTimelineItem => item !== null);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get decision timeline',
          cause: error,
        }),
    });

  // Context Queries
  const getDecisionContext = (
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Effect.Effect<DecisionWithRelations[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        // Find all decisions linked to this entity
        const links = await db.query.decisionLinks.findMany({
          where: and(eq(decisionLinks.entityType, entityType), eq(decisionLinks.entityId, entityId)),
          with: {
            decision: {
              with: {
                video: {
                  columns: { id: true, title: true, thumbnailUrl: true },
                },
                participants: {
                  with: {
                    user: {
                      columns: { id: true, name: true, image: true },
                    },
                  },
                },
                links: true,
              },
            },
          },
        });

        // Filter to only decisions from this organization
        const decisions = links
          .map((link) => normalizeOne(link.decision))
          .filter(
            (decision): decision is NonNullable<typeof decision> =>
              !!decision && decision.organizationId === organizationId,
          )
          .map((decision) => normalizeDecisionRelations(decision));

        return decisions;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get decision context',
          cause: error,
        }),
    });

  // Bulk Operations
  const saveDecisionsFromVideo = (
    videoId: string,
    organizationId: string,
    extractedDecisions: Array<{
      summary: string;
      context?: string;
      reasoning?: string;
      timestampStart: number;
      timestampEnd?: number;
      decisionType: DecisionType;
      status: DecisionStatus;
      confidence: number;
      tags: string[];
      participants: Array<{
        name: string;
        role: 'decider' | 'participant' | 'mentioned';
        attributedText?: string;
      }>;
      externalRefs?: Array<{
        type: string;
        id: string;
        url?: string;
      }>;
    }>,
  ): Effect.Effect<Decision[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (extractedDecisions.length === 0) return [];

        const savedDecisions: Decision[] = [];

        for (const extracted of extractedDecisions) {
          // Create the decision
          const [decision] = await db
            .insert(decisions)
            .values({
              organizationId,
              videoId,
              summary: extracted.summary,
              context: extracted.context,
              reasoning: extracted.reasoning,
              timestampStart: extracted.timestampStart,
              timestampEnd: extracted.timestampEnd,
              decisionType: extracted.decisionType,
              status: extracted.status,
              confidence: extracted.confidence,
              tags: extracted.tags,
              metadata: extracted.externalRefs ? { externalRefs: extracted.externalRefs } : undefined,
            })
            .returning();

          savedDecisions.push(decision);

          // Add participants
          if (extracted.participants.length > 0) {
            const participantData = extracted.participants.map(
              (p: { name: string; role: 'decider' | 'participant' | 'mentioned'; attributedText?: string }) => ({
                decisionId: decision.id,
                userId: null,
                speakerName: p.name,
                role: p.role,
                attributedText: p.attributedText,
              }),
            );
            await db.insert(decisionParticipants).values(participantData);
          }

          // Add links for external references
          if (extracted.externalRefs && extracted.externalRefs.length > 0) {
            const linkData = extracted.externalRefs.map((ref) => ({
              decisionId: decision.id,
              entityType: ref.type.split(':')[0] ?? ref.type,
              entityId: ref.id,
              entityRef: ref.id,
              linkType: 'references',
              url: ref.url,
            }));
            await db.insert(decisionLinks).values(linkData);
          }
        }

        return savedDecisions;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to save decisions from video',
          cause: error,
        }),
    });

  return {
    createDecision,
    getDecision,
    updateDecision,
    deleteDecision,
    listDecisions,
    addParticipant,
    addParticipants,
    removeParticipant,
    addLink,
    addLinks,
    removeLink,
    getLinksByEntity,
    createNode,
    getNode,
    getNodeByExternalId,
    upsertNode,
    listNodes,
    createEdge,
    createEdges,
    deleteEdge,
    getEdgesBetween,
    getGraph,
    getDecisionTimeline,
    getDecisionContext,
    saveDecisionsFromVideo,
  } satisfies KnowledgeGraphRepositoryInterface;
});

// =============================================================================
// Layer
// =============================================================================

export const KnowledgeGraphRepositoryLive = Layer.effect(KnowledgeGraphRepository, makeKnowledgeGraphRepository);
