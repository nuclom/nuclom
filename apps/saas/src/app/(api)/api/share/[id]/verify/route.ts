import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import {
  DatabaseError,
  MissingFieldError,
  NotFoundError,
  ValidationError,
  VideoShareLinksRepository,
} from '@nuclom/lib/effect';
import { validateRequestBody } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';

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
// POST /api/share/[id]/verify - Verify password for protected share link
// =============================================================================

const VerifyPasswordBodySchema = Schema.Struct({
  password: Schema.String,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);
    const shareLinkRepo = yield* VideoShareLinksRepository;

    // Parse request body
    const body = yield* validateRequestBody(VerifyPasswordBodySchema, request);

    if (!body.password) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: 'password',
          message: 'Password is required',
        }),
      );
    }

    // Get share link
    const shareLinkOption = yield* shareLinkRepo.getShareLinkOption(id);
    if (Option.isNone(shareLinkOption)) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Share link not found',
          entity: 'VideoShareLink',
          id,
        }),
      );
    }
    const shareLink = shareLinkOption.value;

    if (!shareLink.password) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'This share link is not password protected',
        }),
      );
    }

    // Hash the provided password and compare
    const hashedPassword = yield* Effect.tryPromise({
      try: () => hashPassword(body.password),
      catch: () =>
        new DatabaseError({
          message: 'Failed to hash password',
          operation: 'hashPassword',
        }),
    });

    if (hashedPassword !== shareLink.password) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Incorrect password',
        }),
      );
    }

    return { verified: true };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
