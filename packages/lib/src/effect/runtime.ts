/**
 * Effect Runtime Configuration
 *
 * Configures the Effect runtime for server-side and client-side use.
 * Following Effect-TS + Next.js best practices for managing stateful services.
 */

import { Cause, Effect, Exit, Layer, Logger, LogLevel, ManagedRuntime, Option } from 'effect';
import { globalValue } from 'effect/GlobalValue';
import { NextResponse } from 'next/server';
import { createLogger } from '../logger';

const log = createLogger('effect-runtime');

import { env } from '../env/server';
// Services
import { type AI, AILive } from './services/ai';
import { type AIChatKB, AIChatKBLive } from './services/ai-chat-kb';
import { makeAuthLayer } from './services/auth';
import { type Billing, BillingLive } from './services/billing';
import { type BillingRepository, BillingRepositoryLive } from './services/billing-repository';
import { type ChatRepository, ChatRepositoryLive } from './services/chat-repository';
import { type ClipRepository, ClipRepositoryLive } from './services/clip-repository';
import { type CollectionRepository, CollectionRepositoryLive } from './services/collection-repository';
import { type ContentProcessor, ContentProcessorLive } from './services/content/content-processor';
import { type ContentRepository, ContentRepositoryLive } from './services/content/content-repository';
import { type Database, DatabaseLive } from './services/database';
import { type EmailNotifications, EmailNotificationsLive } from './services/email-notifications';
import { type Embedding, EmbeddingLive } from './services/embedding';
import { type IntegrationRepository, IntegrationRepositoryLive } from './services/integration-repository';
import { type DecisionTracker, DecisionTrackerLive } from './services/knowledge/decision-tracker';
import { type RelationshipDetector, RelationshipDetectorLive } from './services/knowledge/relationship-detector';
import { type TopicCluster, TopicClusterLive } from './services/knowledge/topic-cluster';
import { type KnowledgeGraphRepository, KnowledgeGraphRepositoryLive } from './services/knowledge-graph-repository';
import { type NotificationRepository, NotificationRepositoryLive } from './services/notification-repository';
import { type OrganizationRepository, OrganizationRepositoryLive } from './services/organization-repository';
import { type Presence, PresenceLive } from './services/presence';
import { type ReplicateAPI, ReplicateLive } from './services/replicate';
import { type UnifiedSearch, UnifiedSearchLive } from './services/search/unified-search';
import { type SearchRepository, SearchRepositoryLive } from './services/search-repository';
import { type SemanticSearchRepository, SemanticSearchRepositoryLive } from './services/semantic-search-repository';
import { type SlackMonitoring, SlackMonitoringLive } from './services/slack-monitoring';
import { type Storage, StorageLive } from './services/storage';
import { StripeServiceLive, type StripeServiceTag } from './services/stripe';
import { type VideoProcessor, VideoProcessorLive } from './services/video-processor';
import { type VideoProgressRepository, VideoProgressRepositoryLive } from './services/video-progress-repository';
import { type VideoRepository, VideoRepositoryLive } from './services/video-repository';
import { type VideoSharesRepository, VideoSharesRepositoryLive } from './services/video-shares-repository';
import { type VocabularyRepository, VocabularyRepositoryLive } from './services/vocabulary-repository';

// =============================================================================
// Layer Composition Utilities
// =============================================================================

/**
 * Helper to provide a single dependency to a layer.
 *
 * @example
 * ```typescript
 * const RepoWithDeps = withDep(RepoLive, DatabaseLive);
 * ```
 */
function withDep<A, E, R1, A2, E2, R2>(
  layer: Layer.Layer<A, E, R1>,
  dep: Layer.Layer<A2, E2, R2>,
): Layer.Layer<A, E | E2, Exclude<R1, A2> | R2> {
  return layer.pipe(Layer.provide(dep)) as Layer.Layer<A, E | E2, Exclude<R1, A2> | R2>;
}

/**
 * Helper to provide two dependencies to a layer.
 *
 * @example
 * ```typescript
 * const RepoWithDeps = withDeps2(RepoLive, DatabaseLive, StorageLive);
 * ```
 */
function withDeps2<A, E, R1, A2, E2, R2, A3, E3, R3>(
  layer: Layer.Layer<A, E, R1>,
  dep1: Layer.Layer<A2, E2, R2>,
  dep2: Layer.Layer<A3, E3, R3>,
): Layer.Layer<A, E | E2 | E3, Exclude<Exclude<R1, A2>, A3> | R2 | R3> {
  return layer.pipe(Layer.provide(Layer.merge(dep1, dep2))) as Layer.Layer<
    A,
    E | E2 | E3,
    Exclude<Exclude<R1, A2>, A3> | R2 | R3
  >;
}

/**
 * Helper to provide multiple dependencies to a layer (4 deps max).
 *
 * @example
 * ```typescript
 * const BillingWithDeps = withDeps(BillingLive, BillingRepositoryLive, StripeServiceLive, DatabaseLive, EmailNotificationsLive);
 * ```
 */
function withDeps<A, E, R1, A2, E2, R2, A3, E3, R3, A4, E4, R4, A5, E5, R5>(
  layer: Layer.Layer<A, E, R1>,
  dep1: Layer.Layer<A2, E2, R2>,
  dep2: Layer.Layer<A3, E3, R3>,
  dep3: Layer.Layer<A4, E4, R4>,
  dep4: Layer.Layer<A5, E5, R5>,
): Layer.Layer<A, E | E2 | E3 | E4 | E5, Exclude<Exclude<Exclude<Exclude<R1, A2>, A3>, A4>, A5> | R2 | R3 | R4 | R5> {
  return layer.pipe(Layer.provide(Layer.mergeAll(dep1, dep2, dep3, dep4))) as Layer.Layer<
    A,
    E | E2 | E3 | E4 | E5,
    Exclude<Exclude<Exclude<Exclude<R1, A2>, A3>, A4>, A5> | R2 | R3 | R4 | R5
  >;
}

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Full application layer (without Auth - Auth is request-scoped)
 * Using withDeps helper to properly compose dependent layers
 */

// Base services layer (no dependencies on other services)
const BaseServicesLive = Layer.mergeAll(
  DatabaseLive,
  StorageLive,
  AILive,
  EmbeddingLive,
  ReplicateLive,
  StripeServiceLive,
  EmailNotificationsLive,
  SlackMonitoringLive,
);

// =============================================================================
// Layer Dependencies (Type-safe with withDep/withDeps2 helpers)
// =============================================================================

// VideoProcessor depends on Storage
const VideoProcessorWithDeps = withDep(VideoProcessorLive, StorageLive);

// Repositories with Database dependency only
const OrganizationRepositoryWithDeps = withDep(OrganizationRepositoryLive, DatabaseLive);
const VideoProgressRepositoryWithDeps = withDep(VideoProgressRepositoryLive, DatabaseLive);
const PresenceWithDeps = withDep(PresenceLive, DatabaseLive);
const NotificationRepositoryWithDeps = withDep(NotificationRepositoryLive, DatabaseLive);
const IntegrationRepositoryWithDeps = withDep(IntegrationRepositoryLive, DatabaseLive);
const BillingRepositoryWithDeps = withDep(BillingRepositoryLive, DatabaseLive);
const SearchRepositoryWithDeps = withDep(SearchRepositoryLive, DatabaseLive);
const CollectionRepositoryWithDeps = withDep(CollectionRepositoryLive, DatabaseLive);
const KnowledgeGraphRepositoryWithDeps = withDep(KnowledgeGraphRepositoryLive, DatabaseLive);
const SemanticSearchRepositoryWithDeps = withDep(SemanticSearchRepositoryLive, DatabaseLive);
const VocabularyRepositoryWithDeps = withDep(VocabularyRepositoryLive, DatabaseLive);
const ChatRepositoryWithDeps = withDep(ChatRepositoryLive, DatabaseLive);
const VideoSharesRepositoryWithDeps = withDep(VideoSharesRepositoryLive, DatabaseLive);
const ContentRepositoryWithDeps = withDep(ContentRepositoryLive, DatabaseLive);

// Repositories with Database + Storage dependencies
const VideoRepositoryWithDeps = withDeps2(VideoRepositoryLive, DatabaseLive, StorageLive);
const ClipRepositoryWithDeps = withDeps2(ClipRepositoryLive, DatabaseLive, StorageLive);

// Billing service depends on BillingRepository, StripeService, Database, and EmailNotifications
const BillingWithDeps = withDeps(
  BillingLive,
  BillingRepositoryWithDeps,
  StripeServiceLive,
  DatabaseLive,
  EmailNotificationsLive,
);

// AIChatKB service depends on Embedding, SemanticSearchRepository, and KnowledgeGraphRepository
const AIChatKBWithDeps = AIChatKBLive.pipe(
  Layer.provide(Layer.mergeAll(EmbeddingLive, SemanticSearchRepositoryWithDeps, KnowledgeGraphRepositoryWithDeps)),
);

// ContentProcessor depends on ContentRepository, Embedding, and AI
const ContentProcessorWithDeps = ContentProcessorLive.pipe(
  Layer.provide(Layer.mergeAll(ContentRepositoryWithDeps, EmbeddingLive, AILive)),
);

// Knowledge Graph Services - depend on ContentRepository, Embedding, and AI
const RelationshipDetectorWithDeps = RelationshipDetectorLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLive, ContentRepositoryWithDeps, EmbeddingLive, AILive)),
);

const TopicClusterWithDeps = TopicClusterLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLive, ContentRepositoryWithDeps, EmbeddingLive, AILive)),
);

const DecisionTrackerWithDeps = DecisionTrackerLive.pipe(
  Layer.provide(Layer.mergeAll(DatabaseLive, ContentRepositoryWithDeps, EmbeddingLive, AILive)),
);

// UnifiedSearch depends on Database and Embedding
const UnifiedSearchWithDeps = withDeps2(UnifiedSearchLive, DatabaseLive, EmbeddingLive);

// Combine application services that have their dependencies resolved
const AppServicesLive = Layer.mergeAll(
  VideoProcessorWithDeps,
  VideoRepositoryWithDeps,
  VideoSharesRepositoryWithDeps,
  OrganizationRepositoryWithDeps,
  VideoProgressRepositoryWithDeps,
  PresenceWithDeps,
  NotificationRepositoryWithDeps,
  IntegrationRepositoryWithDeps,
  BillingRepositoryWithDeps,
  BillingWithDeps,
  SearchRepositoryWithDeps,
  SemanticSearchRepositoryWithDeps,
  CollectionRepositoryWithDeps,
  ClipRepositoryWithDeps,
  KnowledgeGraphRepositoryWithDeps,
  VocabularyRepositoryWithDeps,
  ChatRepositoryWithDeps,
  AIChatKBWithDeps,
  ContentRepositoryWithDeps,
  ContentProcessorWithDeps,
  RelationshipDetectorWithDeps,
  TopicClusterWithDeps,
  DecisionTrackerWithDeps,
  UnifiedSearchWithDeps,
);

// Full application layer - merge base and app services
export const AppLive = Layer.mergeAll(BaseServicesLive, AppServicesLive);

/**
 * Full application layer type
 */
export type AppServices =
  | Database
  | Storage
  | AI
  | AIChatKB
  | Embedding
  | ReplicateAPI
  | VideoProcessor
  | VideoRepository
  | VideoSharesRepository
  | OrganizationRepository
  | VideoProgressRepository
  | Presence
  | NotificationRepository
  | EmailNotifications
  | IntegrationRepository
  | BillingRepository
  | Billing
  | SearchRepository
  | SemanticSearchRepository
  | CollectionRepository
  | ClipRepository
  | KnowledgeGraphRepository
  | VocabularyRepository
  | ChatRepository
  | StripeServiceTag
  | SlackMonitoring
  | ContentRepository
  | ContentProcessor
  | RelationshipDetector
  | TopicCluster
  | DecisionTracker
  | UnifiedSearch;

// =============================================================================
// Global Runtime (for stateful layers)
// =============================================================================

/**
 * Global managed runtime for the application
 * Using GlobalValue to ensure single instance across HMR in development
 */
export const AppRuntime = globalValue('@nuclom/effect-runtime', () => ManagedRuntime.make(AppLive));

// =============================================================================
// Runtime Helpers
// =============================================================================

/**
 * Run an Effect using the global runtime
 */
export const runEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  AppRuntime.runPromise(effect as Effect.Effect<A, E, never>) as Promise<A>;

/**
 * Run an Effect with exit handling
 */
export const runEffectExit = <A, E>(effect: Effect.Effect<A, E>): Promise<Exit.Exit<A, E>> =>
  AppRuntime.runPromiseExit(effect as Effect.Effect<A, E, never>) as Promise<Exit.Exit<A, E>>;

/**
 * Run an Effect synchronously (for sync operations only)
 */
export const runEffectSync = <A>(effect: Effect.Effect<A, never, never>): A => Effect.runSync(effect);

// =============================================================================
// Next.js API Route Helpers
// =============================================================================

/**
 * Maps Effect errors to HTTP responses
 */
export const mapErrorToResponse = (error: unknown): NextResponse => {
  // Handle tagged errors
  if (error && typeof error === 'object' && '_tag' in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case 'UnauthorizedError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });

      case 'ForbiddenError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 403 });

      case 'NotFoundError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });

      case 'ValidationError':
      case 'MissingFieldError':
      case 'UnsupportedFormatError':
      case 'FileSizeExceededError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });

      case 'StorageNotConfiguredError':
      case 'StripeNotConfiguredError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 503 });

      case 'PlanLimitExceededError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });

      case 'NoSubscriptionError':
      case 'PlanNotFoundError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });

      case 'PaymentFailedError':
      case 'SubscriptionError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });

      case 'WebhookSignatureError':
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });

      case 'DatabaseError':
      case 'TransactionError':
      case 'UploadError':
      case 'VideoProcessingError':
      case 'AIServiceError':
      case 'TranscriptionError':
      case 'AudioExtractionError':
      case 'VideoAIProcessingError':
      case 'StripeApiError':
      case 'UsageTrackingError':
        log.error({ tag: taggedError._tag, message: taggedError.message }, 'Service error');
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });

      default:
        log.error({ tag: taggedError._tag, err: error }, 'Unknown tagged error');
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }

  // Handle regular errors
  log.error({ err: error }, 'Unhandled error');
  return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
};

/**
 * Create a Next.js API route handler from an Effect
 */
export const createHandler = <A, E extends { _tag: string; message: string }>(
  effect: Effect.Effect<A, E>,
  options?: {
    successStatus?: number;
    transform?: (data: A) => unknown;
  },
) => {
  return async (): Promise<NextResponse> => {
    const exit = await runEffectExit(effect);

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (Option.isSome(error)) {
          return mapErrorToResponse(error.value);
        }
        // Handle defects (unexpected errors)
        const defect = Cause.dieOption(cause);
        if (Option.isSome(defect)) {
          log.error({ defect: defect.value }, 'Effect defect');
        }
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
      },
      onSuccess: (data) => {
        const responseData = options?.transform ? options.transform(data) : data;
        return NextResponse.json({ success: true, data: responseData }, { status: options?.successStatus ?? 200 });
      },
    });
  };
};

/**
 * Create a handler with Auth layer
 */
export const createAuthenticatedHandler = <A, E extends { _tag: string; message: string }>(
  authInstance: Parameters<typeof makeAuthLayer>[0],
  effectFn: () => Effect.Effect<A, E>,
  options?: {
    successStatus?: number;
    transform?: (data: A) => unknown;
  },
) => {
  return async (): Promise<NextResponse> => {
    const AuthLayer = makeAuthLayer(authInstance);
    const FullLayer = Layer.provideMerge(AppLive, AuthLayer);

    const runnable = Effect.provide(effectFn(), FullLayer);
    const exit = await Effect.runPromiseExit(runnable);

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (Option.isSome(error)) {
          return mapErrorToResponse(error.value);
        }
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
      },
      onSuccess: (data) => {
        const responseData = options?.transform ? options.transform(data) : data;
        return NextResponse.json({ success: true, data: responseData }, { status: options?.successStatus ?? 200 });
      },
    });
  };
};

// =============================================================================
// Effect Utilities for API Routes
// =============================================================================

/**
 * Run an Effect and return a NextResponse
 * Use this in API routes for consistent error handling
 */
export const effectToResponse = async <A, E>(
  effect: Effect.Effect<A, E>,
  options?: {
    successStatus?: number;
    transform?: (data: A) => unknown;
  },
): Promise<NextResponse> => {
  const exit = await runEffectExit(effect);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    },
    onSuccess: (data) => {
      const responseData = options?.transform ? options.transform(data) : data;
      return NextResponse.json(responseData, { status: options?.successStatus ?? 200 });
    },
  });
};

/**
 * Run an Effect with provided layers and return a NextResponse
 */
export const effectWithLayersToResponse = async <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R>,
  options?: {
    successStatus?: number;
    transform?: (data: A) => unknown;
  },
): Promise<NextResponse> => {
  const runnable = Effect.provide(effect, layer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    },
    onSuccess: (data) => {
      const responseData = options?.transform ? options.transform(data) : data;
      return NextResponse.json(responseData, { status: options?.successStatus ?? 200 });
    },
  });
};

// =============================================================================
// Development Logging
// =============================================================================

/**
 * Logger layer for development
 */
export const DevLoggerLive = Logger.replace(Logger.defaultLogger, Logger.prettyLogger());

/**
 * Minimum log level layer
 */
export const LogLevelLive = Logger.minimumLogLevel(env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info);

/**
 * Full logging configuration
 */
export const LoggingLive = Layer.mergeAll(DevLoggerLive, LogLevelLive);
