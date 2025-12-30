/**
 * Effect Runtime Configuration
 *
 * Configures the Effect runtime for server-side and client-side use.
 * Following Effect-TS + Next.js best practices for managing stateful services.
 */

import process from "node:process";
import { Cause, Effect, Exit, Layer, Logger, LogLevel, ManagedRuntime, Option } from "effect";
import { globalValue } from "effect/GlobalValue";
import { NextResponse } from "next/server";
// Services
import { type AI, AILive } from "./services/ai";
import { makeAuthLayer } from "./services/auth";
import { type Billing, BillingLive } from "./services/billing";
import { type BillingRepository, BillingRepositoryLive } from "./services/billing-repository";
import { type CommentRepository, CommentRepositoryLive } from "./services/comment-repository";
import { type Database, DatabaseLive } from "./services/database";
import { type IntegrationRepository, IntegrationRepositoryLive } from "./services/integration-repository";
import { type NotificationRepository, NotificationRepositoryLive } from "./services/notification-repository";
import { type EmailNotifications, EmailNotificationsLive } from "./services/email-notifications";
import { type OrganizationRepository, OrganizationRepositoryLive } from "./services/organization-repository";
import { type ReplicateAPI, ReplicateLive } from "./services/replicate";
import { type SearchRepository, SearchRepositoryLive } from "./services/search-repository";
import { type SeriesRepository, SeriesRepositoryLive } from "./services/series-repository";
import { type Storage, StorageLive } from "./services/storage";
import { StripeServiceLive, type StripeServiceTag } from "./services/stripe";
import { type VideoProcessor, VideoProcessorLive } from "./services/video-processor";
import { type VideoProgressRepository, VideoProgressRepositoryLive } from "./services/video-progress-repository";
import { type VideoRepository, VideoRepositoryLive } from "./services/video-repository";

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Full application layer (without Auth - Auth is request-scoped)
 * Using Layer.provide to properly compose dependent layers
 */

// Base services layer (no dependencies on other services)
const BaseServicesLive = Layer.mergeAll(DatabaseLive, StorageLive, AILive, ReplicateLive, StripeServiceLive, EmailNotificationsLive);

// VideoProcessor depends on Storage - provide its dependency
const VideoProcessorWithDeps = VideoProcessorLive.pipe(Layer.provide(StorageLive));

// Repositories depend on Database - provide their dependencies
const VideoRepositoryWithDeps = VideoRepositoryLive.pipe(Layer.provide(DatabaseLive));
const OrganizationRepositoryWithDeps = OrganizationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const VideoProgressRepositoryWithDeps = VideoProgressRepositoryLive.pipe(Layer.provide(DatabaseLive));
const CommentRepositoryWithDeps = CommentRepositoryLive.pipe(Layer.provide(DatabaseLive));
const NotificationRepositoryWithDeps = NotificationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const BillingRepositoryWithDeps = BillingRepositoryLive.pipe(Layer.provide(DatabaseLive));
const SearchRepositoryWithDeps = SearchRepositoryLive.pipe(Layer.provide(DatabaseLive));
const SeriesRepositoryWithDeps = SeriesRepositoryLive.pipe(Layer.provide(DatabaseLive));

// Billing service depends on BillingRepository, StripeService, Database, and EmailNotifications
const BillingWithDeps = BillingLive.pipe(
  Layer.provide(Layer.mergeAll(BillingRepositoryWithDeps, StripeServiceLive, DatabaseLive, EmailNotificationsLive)),
);

// Combine application services that have their dependencies resolved
const AppServicesLive = Layer.mergeAll(
  VideoProcessorWithDeps,
  VideoRepositoryWithDeps,
  OrganizationRepositoryWithDeps,
  VideoProgressRepositoryWithDeps,
  CommentRepositoryWithDeps,
  NotificationRepositoryWithDeps,
  IntegrationRepositoryWithDeps,
  BillingRepositoryWithDeps,
  BillingWithDeps,
  SearchRepositoryWithDeps,
  SeriesRepositoryWithDeps,
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
  | ReplicateAPI
  | VideoProcessor
  | VideoRepository
  | OrganizationRepository
  | VideoProgressRepository
  | CommentRepository
  | NotificationRepository
  | EmailNotifications
  | IntegrationRepository
  | BillingRepository
  | Billing
  | SearchRepository
  | SeriesRepository
  | StripeServiceTag;

// =============================================================================
// Global Runtime (for stateful layers)
// =============================================================================

/**
 * Global managed runtime for the application
 * Using GlobalValue to ensure single instance across HMR in development
 */
export const AppRuntime = globalValue("@nuclom/effect-runtime", () => ManagedRuntime.make(AppLive));

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
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });

      case "ForbiddenError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 403 });

      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });

      case "ValidationError":
      case "MissingFieldError":
      case "UnsupportedFormatError":
      case "FileSizeExceededError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });

      case "StorageNotConfiguredError":
      case "StripeNotConfiguredError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 503 });

      case "PlanLimitExceededError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });

      case "NoSubscriptionError":
      case "PlanNotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });

      case "PaymentFailedError":
      case "SubscriptionError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 402 });

      case "WebhookSignatureError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });

      case "DatabaseError":
      case "TransactionError":
      case "UploadError":
      case "VideoProcessingError":
      case "AIServiceError":
      case "TranscriptionError":
      case "AudioExtractionError":
      case "VideoAIProcessingError":
      case "StripeApiError":
      case "UsageTrackingError":
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });

      default:
        console.error("[UnknownTaggedError]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }

  // Handle regular errors
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
          console.error("[Defect]", defect.value);
        }
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
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
export const LogLevelLive = Logger.minimumLogLevel(
  process.env.NODE_ENV === "development" ? LogLevel.Debug : LogLevel.Info,
);

/**
 * Full logging configuration
 */
export const LoggingLive = Layer.mergeAll(DevLoggerLive, LogLevelLive);
