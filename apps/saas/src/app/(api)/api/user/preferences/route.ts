import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { userPreferences } from '@nuclom/lib/db/schema';
import { DatabaseError } from '@nuclom/lib/effect/errors';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { Database } from '@nuclom/lib/effect/services/database';
import { safeParse } from '@nuclom/lib/validation';
import { eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';

const UpdatePreferencesSchema = Schema.Struct({
  emailNotifications: Schema.optional(Schema.Boolean),
  emailCommentReplies: Schema.optional(Schema.Boolean),
  emailMentions: Schema.optional(Schema.Boolean),
  emailVideoProcessing: Schema.optional(Schema.Boolean),
  emailWeeklyDigest: Schema.optional(Schema.Boolean),
  emailProductUpdates: Schema.optional(Schema.Boolean),
  pushNotifications: Schema.optional(Schema.Boolean),
  theme: Schema.optional(Schema.Literal('light', 'dark', 'system')),
  showActivityStatus: Schema.optional(Schema.Boolean),
});

// Default preferences
const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  emailCommentReplies: true,
  emailMentions: true,
  emailVideoProcessing: true,
  emailWeeklyDigest: false,
  emailProductUpdates: true,
  pushNotifications: true,
  theme: 'system' as const,
  showActivityStatus: true,
};

// =============================================================================
// GET /api/user/preferences - Get user notification preferences
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get user preferences or return defaults
    const preferences = yield* Effect.tryPromise({
      try: () =>
        db.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, user.id),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch preferences',
          operation: 'getUserPreferences',
          cause: error,
        }),
    });

    if (!preferences) {
      return DEFAULT_PREFERENCES;
    }

    return preferences;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// PUT /api/user/preferences - Update user notification preferences
// =============================================================================

export async function PUT(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const rawBody = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new DatabaseError({
          message: 'Invalid request body',
          operation: 'parseBody',
        }),
    });

    const result = safeParse(UpdatePreferencesSchema, rawBody);
    if (!result.success) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Invalid request format',
          operation: 'validatePreferences',
        }),
      );
    }

    const {
      emailNotifications,
      emailCommentReplies,
      emailMentions,
      emailVideoProcessing,
      emailWeeklyDigest,
      emailProductUpdates,
      pushNotifications,
      theme,
      showActivityStatus,
    } = result.data;

    // Check if preferences exist
    const existing = yield* Effect.tryPromise({
      try: () =>
        db.query.userPreferences.findFirst({
          where: eq(userPreferences.userId, user.id),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to check existing preferences',
          operation: 'checkPreferences',
          cause: error,
        }),
    });

    const updateData = {
      emailNotifications: emailNotifications ?? true,
      emailCommentReplies: emailCommentReplies ?? true,
      emailMentions: emailMentions ?? true,
      emailVideoProcessing: emailVideoProcessing ?? true,
      emailWeeklyDigest: emailWeeklyDigest ?? false,
      emailProductUpdates: emailProductUpdates ?? true,
      pushNotifications: pushNotifications ?? true,
      theme: theme ?? 'system',
      showActivityStatus: showActivityStatus ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing preferences
      yield* Effect.tryPromise({
        try: () => db.update(userPreferences).set(updateData).where(eq(userPreferences.userId, user.id)),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update preferences',
            operation: 'updatePreferences',
            cause: error,
          }),
      });
    } else {
      // Create new preferences
      yield* Effect.tryPromise({
        try: () =>
          db.insert(userPreferences).values({
            userId: user.id,
            ...updateData,
            createdAt: new Date(),
          }),
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to create preferences',
            operation: 'createPreferences',
            cause: error,
          }),
      });
    }

    return { success: true };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
