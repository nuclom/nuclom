import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { videoShareLinks, videos } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError, ValidationError } from '@nuclom/lib/effect';
import { Database } from '@nuclom/lib/effect/services/database';
import type { ApiResponse } from '@nuclom/lib/types';
import { validateRequestBody } from '@nuclom/lib/validation';
import { eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// Hash Password Helper
// =============================================================================

// Hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// =============================================================================
// GET /api/videos/[id]/share - List share links for video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Get share links for video with creator info
    const links = yield* Effect.tryPromise({
      try: () =>
        db.query.videoShareLinks.findMany({
          where: eq(videoShareLinks.videoId, id),
          with: {
            creator: {
              columns: { name: true },
            },
          },
          orderBy: (links, { desc }) => [desc(links.createdAt)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch share links',
          operation: 'getShareLinks',
          cause: error,
        }),
    });

    // Don't expose password hashes
    const data = links.map((link) => ({
      ...link,
      password: link.password ? true : null, // Just indicate if password is set
    }));

    const response: ApiResponse = {
      success: true,
      data,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/videos/[id]/share - Create share link
// =============================================================================

const CreateShareLinkBodySchema = Schema.Struct({
  accessLevel: Schema.optional(Schema.Literal('view', 'comment', 'download')),
  password: Schema.optional(Schema.String),
  expiresIn: Schema.optional(Schema.Literal('never', '1d', '7d', '30d')),
  maxViews: Schema.optional(Schema.Number),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { db } = yield* Database;
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* validateRequestBody(CreateShareLinkBodySchema, request);

    // Verify video exists
    const video = yield* Effect.tryPromise({
      try: () => db.query.videos.findFirst({ where: eq(videos.id, id) }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch video',
          operation: 'getVideo',
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id,
        }),
      );
    }

    // Validate access level
    const validAccessLevels = ['view', 'comment', 'download'] as const;
    const accessLevel = body.accessLevel || 'view';
    if (!validAccessLevels.includes(accessLevel)) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Invalid access level. Valid levels: ${validAccessLevels.join(', ')}`,
        }),
      );
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (body.expiresIn && body.expiresIn !== 'never') {
      const now = new Date();
      switch (body.expiresIn) {
        case '1d':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    const passwordToHash = body.password?.trim();
    if (passwordToHash) {
      hashedPassword = yield* Effect.tryPromise({
        try: () => hashPassword(passwordToHash),
        catch: () =>
          new DatabaseError({
            message: 'Failed to hash password',
            operation: 'hashPassword',
          }),
      });
    }

    // Create share link
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(videoShareLinks)
          .values({
            videoId: id,
            createdBy: user.id,
            accessLevel,
            password: hashedPassword,
            expiresAt,
            maxViews: body.maxViews || null,
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create share link',
          operation: 'createShareLink',
          cause: error,
        }),
    });

    const data = {
      ...result[0],
      password: hashedPassword ? true : null, // Don't expose hash
    };

    const response: ApiResponse = {
      success: true,
      data,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === 'Success') {
    return NextResponse.json(exit.value, { status: 201 });
  }

  return handleEffectExit(exit);
}
