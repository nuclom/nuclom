/**
 * Effect-TS Test Utilities
 *
 * Provides mock layers and utilities for testing Effect-TS services
 * using dependency injection patterns.
 */

import { type Context, Effect, Layer } from 'effect';
import { vi } from 'vitest';
import type { Comment, User, Video } from '@/lib/db/schema';
import type { CommentWithAuthor, CommentWithReplies } from '@/lib/effect/services/comment-repository';
import type { NotificationWithActor } from '@/lib/effect/services/notification-repository';
import type { PaginatedResponse, VideoWithAuthor } from '@/lib/types';
import { createMockOrganization, createMockUser, createMockVideo } from './mocks';

// =============================================================================
// Mock Database Service
// =============================================================================

export interface MockDatabaseService {
  db: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    leftJoin: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
    query: {
      videos: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      users: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      comments: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      organizations: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      notifications: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    };
  };
  client: unknown;
}

/**
 * Creates a chainable mock database for testing
 */
export function createMockDatabaseService(): MockDatabaseService {
  const chainable = () => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    query: {
      videos: { findFirst: vi.fn(), findMany: vi.fn() },
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      comments: { findFirst: vi.fn(), findMany: vi.fn() },
      organizations: { findFirst: vi.fn(), findMany: vi.fn() },
      notifications: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  });

  const db = chainable();

  // Make chainable methods return 'this' properly
  db.select.mockReturnValue(db);
  db.from.mockReturnValue(db);
  db.where.mockReturnValue(db);
  db.innerJoin.mockReturnValue(db);
  db.leftJoin.mockReturnValue(db);
  db.orderBy.mockReturnValue(db);
  db.limit.mockReturnValue(db);
  db.offset.mockReturnValue(db);
  db.insert.mockReturnValue(db);
  db.values.mockReturnValue(db);
  db.update.mockReturnValue(db);
  db.set.mockReturnValue(db);
  db.delete.mockReturnValue(db);

  return { db: db as unknown as MockDatabaseService['db'], client: {} };
}

// Import Database tag from the actual service
import { Database } from '@/lib/effect/services/database';

/**
 * Creates a mock Database layer for testing
 */
export function createMockDatabaseLayer(mockDb?: MockDatabaseService) {
  const db = mockDb ?? createMockDatabaseService();
  return Layer.succeed(Database, db as unknown as Context.Tag.Service<typeof Database>);
}

// =============================================================================
// Mock Storage Service
// =============================================================================

export interface MockStorageService {
  uploadFile: ReturnType<typeof vi.fn>;
  uploadLargeFile: ReturnType<typeof vi.fn>;
  deleteFile: ReturnType<typeof vi.fn>;
  generatePresignedUploadUrl: ReturnType<typeof vi.fn>;
  getPublicUrl: ReturnType<typeof vi.fn>;
  generateFileKey: ReturnType<typeof vi.fn>;
  isConfigured: boolean;
}

export function createMockStorageService(): MockStorageService {
  return {
    uploadFile: vi
      .fn()
      .mockImplementation((_buffer, key) =>
        Effect.succeed({ key, url: `https://storage.example.com/${key}`, etag: 'mock-etag' }),
      ),
    uploadLargeFile: vi
      .fn()
      .mockImplementation((_buffer, key) =>
        Effect.succeed({ key, url: `https://storage.example.com/${key}`, etag: 'mock-etag' }),
      ),
    deleteFile: vi.fn().mockImplementation(() => Effect.void),
    generatePresignedUploadUrl: vi
      .fn()
      .mockImplementation((key) => Effect.succeed(`https://storage.example.com/presigned/${key}`)),
    getPublicUrl: vi.fn().mockImplementation((key) => `https://storage.example.com/${key}`),
    generateFileKey: vi
      .fn()
      .mockImplementation((orgId, filename, type = 'video') => `${orgId}/${type}s/${Date.now()}-${filename}`),
    isConfigured: true,
  };
}

import { Storage } from '@/lib/effect/services/storage';

export function createMockStorageLayer(mockStorage?: MockStorageService) {
  const storage = mockStorage ?? createMockStorageService();
  return Layer.succeed(Storage, storage as unknown as Context.Tag.Service<typeof Storage>);
}

// =============================================================================
// Mock VideoRepository Service
// =============================================================================

import { DatabaseError, DeleteError, NotFoundError } from '@/lib/effect/errors';
import { VideoRepository, type VideoRepositoryService } from '@/lib/effect/services/video-repository';

export interface MockVideoRepositoryService {
  getVideos: ReturnType<typeof vi.fn>;
  getDeletedVideos: ReturnType<typeof vi.fn>;
  getVideo: ReturnType<typeof vi.fn>;
  createVideo: ReturnType<typeof vi.fn>;
  updateVideo: ReturnType<typeof vi.fn>;
  softDeleteVideo: ReturnType<typeof vi.fn>;
  restoreVideo: ReturnType<typeof vi.fn>;
  deleteVideo: ReturnType<typeof vi.fn>;
  cleanupExpiredVideos: ReturnType<typeof vi.fn>;
  getVideoChapters: ReturnType<typeof vi.fn>;
  searchVideos: ReturnType<typeof vi.fn>;
  getVideosByAuthor: ReturnType<typeof vi.fn>;
  getChannelVideosWithAuthor: ReturnType<typeof vi.fn>;
  getVideosSharedByOthers: ReturnType<typeof vi.fn>;
}

export function createMockVideoRepositoryService(): MockVideoRepositoryService {
  const mockVideo = createMockVideoWithFullAuthor();
  const paginatedResponse: PaginatedResponse<VideoWithAuthor> = {
    data: [mockVideo],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  return {
    getVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    getDeletedVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    getVideo: vi.fn().mockImplementation(() => Effect.succeed(mockVideo)),
    createVideo: vi.fn().mockImplementation((data) => Effect.succeed({ ...createMockVideo(), ...data })),
    updateVideo: vi.fn().mockImplementation((id, data) => Effect.succeed({ ...createMockVideo({ id }), ...data })),
    softDeleteVideo: vi
      .fn()
      .mockImplementation((id) => Effect.succeed({ ...createMockVideo({ id }), deletedAt: new Date() })),
    restoreVideo: vi.fn().mockImplementation((id) => Effect.succeed({ ...createMockVideo({ id }), deletedAt: null })),
    deleteVideo: vi.fn().mockImplementation(() => Effect.void),
    cleanupExpiredVideos: vi.fn().mockImplementation(() => Effect.succeed(0)),
    getVideoChapters: vi.fn().mockImplementation(() => Effect.succeed([])),
    searchVideos: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    getVideosByAuthor: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    getChannelVideosWithAuthor: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
    getVideosSharedByOthers: vi.fn().mockImplementation(() => Effect.succeed(paginatedResponse)),
  };
}

export function createMockVideoRepositoryLayer(mockRepo?: MockVideoRepositoryService) {
  const repo = mockRepo ?? createMockVideoRepositoryService();
  return Layer.succeed(VideoRepository, repo as unknown as VideoRepositoryService);
}

// =============================================================================
// Mock CommentRepository Service
// =============================================================================

import { CommentRepository, type CommentRepositoryService } from '@/lib/effect/services/comment-repository';

export interface MockCommentRepositoryService {
  getComments: ReturnType<typeof vi.fn>;
  getComment: ReturnType<typeof vi.fn>;
  createComment: ReturnType<typeof vi.fn>;
  updateComment: ReturnType<typeof vi.fn>;
  deleteComment: ReturnType<typeof vi.fn>;
  getCommentsByTimestamp: ReturnType<typeof vi.fn>;
}

export function createMockCommentRepositoryService(): MockCommentRepositoryService {
  const mockComment = createMockCommentWithAuthor();

  return {
    getComments: vi.fn().mockImplementation(() => Effect.succeed([])),
    getComment: vi.fn().mockImplementation(() => Effect.succeed(mockComment)),
    createComment: vi.fn().mockImplementation((data) => Effect.succeed({ ...mockComment, ...data })),
    updateComment: vi.fn().mockImplementation((id, _authorId, data) => Effect.succeed({ ...mockComment, id, ...data })),
    deleteComment: vi.fn().mockImplementation((id) => Effect.succeed({ ...mockComment, id })),
    getCommentsByTimestamp: vi.fn().mockImplementation(() => Effect.succeed([])),
  };
}

export function createMockCommentRepositoryLayer(mockRepo?: MockCommentRepositoryService) {
  const repo = mockRepo ?? createMockCommentRepositoryService();
  return Layer.succeed(CommentRepository, repo as unknown as CommentRepositoryService);
}

// =============================================================================
// Mock NotificationRepository Service
// =============================================================================

import {
  NotificationRepository,
  type NotificationRepositoryService,
} from '@/lib/effect/services/notification-repository';

export interface MockNotificationRepositoryService {
  getNotifications: ReturnType<typeof vi.fn>;
  getUnreadCount: ReturnType<typeof vi.fn>;
  markAsRead: ReturnType<typeof vi.fn>;
  markAllAsRead: ReturnType<typeof vi.fn>;
  createNotification: ReturnType<typeof vi.fn>;
  deleteNotification: ReturnType<typeof vi.fn>;
}

export function createMockNotificationRepositoryService(): MockNotificationRepositoryService {
  return {
    getNotifications: vi
      .fn()
      .mockImplementation(() =>
        Effect.succeed({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      ),
    getUnreadCount: vi.fn().mockImplementation(() => Effect.succeed(0)),
    markAsRead: vi.fn().mockImplementation(() => Effect.succeed(createMockNotification())),
    markAllAsRead: vi.fn().mockImplementation(() => Effect.succeed(0)),
    createNotification: vi.fn().mockImplementation((data) => Effect.succeed({ ...createMockNotification(), ...data })),
    deleteNotification: vi.fn().mockImplementation(() => Effect.void),
  };
}

export function createMockNotificationRepositoryLayer(mockRepo?: MockNotificationRepositoryService) {
  const repo = mockRepo ?? createMockNotificationRepositoryService();
  return Layer.succeed(NotificationRepository, repo as unknown as NotificationRepositoryService);
}

// =============================================================================
// Mock OrganizationRepository Service
// =============================================================================

import {
  OrganizationRepository,
  type OrganizationRepositoryService,
} from '@/lib/effect/services/organization-repository';

export interface MockOrganizationRepositoryService {
  getOrganization: ReturnType<typeof vi.fn>;
  getOrganizationBySlug: ReturnType<typeof vi.fn>;
  getUserOrganizations: ReturnType<typeof vi.fn>;
  createOrganization: ReturnType<typeof vi.fn>;
  updateOrganization: ReturnType<typeof vi.fn>;
  deleteOrganization: ReturnType<typeof vi.fn>;
  getOrganizationMembers: ReturnType<typeof vi.fn>;
  addMember: ReturnType<typeof vi.fn>;
  removeMember: ReturnType<typeof vi.fn>;
  updateMemberRole: ReturnType<typeof vi.fn>;
}

export function createMockOrganizationRepositoryService(): MockOrganizationRepositoryService {
  const mockOrg = createMockOrganization();

  return {
    getOrganization: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
    getOrganizationBySlug: vi.fn().mockImplementation(() => Effect.succeed(mockOrg)),
    getUserOrganizations: vi.fn().mockImplementation(() => Effect.succeed([mockOrg])),
    createOrganization: vi.fn().mockImplementation((data) => Effect.succeed({ ...mockOrg, ...data })),
    updateOrganization: vi.fn().mockImplementation((id, data) => Effect.succeed({ ...mockOrg, id, ...data })),
    deleteOrganization: vi.fn().mockImplementation(() => Effect.void),
    getOrganizationMembers: vi.fn().mockImplementation(() => Effect.succeed([])),
    addMember: vi.fn().mockImplementation(() => Effect.succeed({})),
    removeMember: vi.fn().mockImplementation(() => Effect.void),
    updateMemberRole: vi.fn().mockImplementation(() => Effect.succeed({})),
  };
}

export function createMockOrganizationRepositoryLayer(mockRepo?: MockOrganizationRepositoryService) {
  const repo = mockRepo ?? createMockOrganizationRepositoryService();
  return Layer.succeed(OrganizationRepository, repo as unknown as OrganizationRepositoryService);
}

// =============================================================================
// Mock Auth Service
// =============================================================================

import { Auth, type AuthServiceInterface } from '@/lib/effect/services/auth';

export interface MockAuthService {
  getSession: ReturnType<typeof vi.fn>;
  requireSession: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
  requireUser: ReturnType<typeof vi.fn>;
  requireOrganizationAccess: ReturnType<typeof vi.fn>;
}

export function createMockAuthService(user?: User): MockAuthService {
  const mockUser = user ?? createMockUser();
  const mockSession = { user: mockUser, session: { id: 'session-123' } };

  return {
    getSession: vi.fn().mockImplementation(() => Effect.succeed(mockSession)),
    requireSession: vi.fn().mockImplementation(() => Effect.succeed(mockSession)),
    getCurrentUser: vi.fn().mockImplementation(() => Effect.succeed(mockUser)),
    requireUser: vi.fn().mockImplementation(() => Effect.succeed(mockUser)),
    requireOrganizationAccess: vi.fn().mockImplementation(() => Effect.succeed(mockUser)),
  };
}

export function createMockAuthLayer(mockAuth?: MockAuthService) {
  const auth = mockAuth ?? createMockAuthService();
  return Layer.succeed(Auth, auth as unknown as AuthServiceInterface);
}

// =============================================================================
// Mock AI Service
// =============================================================================

import { AI, type AIServiceInterface } from '@/lib/effect/services/ai';

export interface MockAIService {
  generateVideoSummary: ReturnType<typeof vi.fn>;
  generateVideoTags: ReturnType<typeof vi.fn>;
  extractActionItems: ReturnType<typeof vi.fn>;
  extractActionItemsWithTimestamps: ReturnType<typeof vi.fn>;
  generateChapters: ReturnType<typeof vi.fn>;
  createSummaryStream: ReturnType<typeof vi.fn>;
  analyzeTranscriptForInsights: ReturnType<typeof vi.fn>;
}

export function createMockAIService(): MockAIService {
  return {
    generateVideoSummary: vi.fn().mockImplementation(() => Effect.succeed('## Summary\nTest summary content')),
    generateVideoTags: vi.fn().mockImplementation(() => Effect.succeed(['tag1', 'tag2', 'tag3'])),
    extractActionItems: vi.fn().mockImplementation(() => Effect.succeed(['Action item 1', 'Action item 2'])),
    extractActionItemsWithTimestamps: vi
      .fn()
      .mockImplementation(() => Effect.succeed([{ text: 'Action item 1', timestamp: 60, priority: 'high' as const }])),
    generateChapters: vi.fn().mockImplementation(() => Effect.succeed([])),
    createSummaryStream: vi.fn(),
    analyzeTranscriptForInsights: vi
      .fn()
      .mockImplementation(() => Effect.succeed({ topics: [], sentiment: 'neutral' })),
  };
}

export function createMockAILayer(mockAI?: MockAIService) {
  const ai = mockAI ?? createMockAIService();
  return Layer.succeed(AI, ai as unknown as AIServiceInterface);
}

// =============================================================================
// Mock Stripe Service
// =============================================================================

import { type StripeService, StripeServiceTag } from '@/lib/effect/services/stripe';

export interface MockStripeService {
  createCustomer: ReturnType<typeof vi.fn>;
  createCheckoutSession: ReturnType<typeof vi.fn>;
  createPortalSession: ReturnType<typeof vi.fn>;
  createSubscription: ReturnType<typeof vi.fn>;
  cancelSubscription: ReturnType<typeof vi.fn>;
  updateSubscription: ReturnType<typeof vi.fn>;
  getSubscription: ReturnType<typeof vi.fn>;
  verifyWebhookSignature: ReturnType<typeof vi.fn>;
  isConfigured: boolean;
}

export function createMockStripeService(): MockStripeService {
  return {
    createCustomer: vi.fn().mockImplementation(() => Effect.succeed({ id: 'cus_test123' })),
    createCheckoutSession: vi
      .fn()
      .mockImplementation(() => Effect.succeed({ url: 'https://checkout.stripe.com/test' })),
    createPortalSession: vi.fn().mockImplementation(() => Effect.succeed({ url: 'https://portal.stripe.com/test' })),
    createSubscription: vi.fn().mockImplementation(() => Effect.succeed({ id: 'sub_test123', status: 'active' })),
    cancelSubscription: vi.fn().mockImplementation(() => Effect.succeed({ id: 'sub_test123', status: 'canceled' })),
    updateSubscription: vi.fn().mockImplementation(() => Effect.succeed({ id: 'sub_test123', status: 'active' })),
    getSubscription: vi.fn().mockImplementation(() => Effect.succeed({ id: 'sub_test123', status: 'active' })),
    verifyWebhookSignature: vi.fn().mockImplementation(() => Effect.succeed({ type: 'customer.subscription.updated' })),
    isConfigured: true,
  };
}

export function createMockStripeLayer(mockStripe?: MockStripeService) {
  const stripe = mockStripe ?? createMockStripeService();
  return Layer.succeed(StripeServiceTag, stripe as unknown as StripeService);
}

// =============================================================================
// Test Data Factories
// =============================================================================

export function createMockVideoWithFullAuthor(
  videoOverrides: Partial<Video> = {},
  userOverrides: Partial<User> = {},
): VideoWithAuthor {
  const video = createMockVideo(videoOverrides);
  const author = createMockUser(userOverrides);
  return {
    ...video,
    deletedAt: null,
    retentionUntil: null,
    author,
  } as VideoWithAuthor;
}

export function createMockCommentWithAuthor(
  commentOverrides: Partial<Comment> = {},
  userOverrides: Partial<User> = {},
): CommentWithAuthor {
  const author = createMockUser(userOverrides);
  return {
    id: 'comment-123',
    content: 'Test comment content',
    timestamp: '00:01:30',
    authorId: author.id,
    videoId: 'video-123',
    parentId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author,
    ...commentOverrides,
  } as CommentWithAuthor;
}

export function createMockCommentWithReplies(
  commentOverrides: Partial<Comment> = {},
  replies: CommentWithAuthor[] = [],
): CommentWithReplies {
  return {
    ...createMockCommentWithAuthor(commentOverrides),
    replies,
  } as CommentWithReplies;
}

export function createMockNotification(overrides: Record<string, unknown> = {}): NotificationWithActor {
  return {
    id: 'notification-123',
    type: 'comment' as const,
    title: 'New Comment',
    message: 'Someone commented on your video',
    read: false,
    userId: 'user-123',
    videoId: 'video-123',
    commentId: 'comment-123',
    createdAt: new Date('2024-01-01'),
    video: null,
    comment: null,
    fromUser: null,
    ...overrides,
  } as unknown as NotificationWithActor;
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Helper to run an Effect with a test layer and return the result
 */
export async function runWithLayer<A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R>): Promise<A> {
  return Effect.runPromise(Effect.provide(effect, layer));
}

/**
 * Helper to run an Effect with a test layer and return the Exit
 */
export async function runWithLayerExit<A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R>) {
  return Effect.runPromiseExit(Effect.provide(effect, layer));
}

/**
 * Creates a failure Effect for testing error handling
 */
export function createDatabaseError(message = 'Database error') {
  return new DatabaseError({ message, operation: 'test' });
}

export function createNotFoundError(entity: string, id: string) {
  return new NotFoundError({ message: `${entity} not found`, entity, id });
}

export function createDeleteError(message = 'Delete failed') {
  return new DeleteError({ message });
}
