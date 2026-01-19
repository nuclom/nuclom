import { createPublicLayer, mapErrorToApiResponse } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { organizations } from '@nuclom/lib/db/schema';
import { DatabaseError, NotFoundError } from '@nuclom/lib/effect';
import type { ApiResponse } from '@nuclom/lib/types';
import { eq } from 'drizzle-orm';
import { Cause, Effect, Exit } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/organizations/slug/[slug] - Get organization by slug
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const organization = yield* Effect.tryPromise({
      try: () =>
        db.query.organizations.findFirst({
          where: eq(organizations.slug, resolvedParams.slug),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch organization',
          operation: 'getOrganizationBySlug',
          cause: error,
        }),
    });

    if (!organization) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Organization not found',
          entity: 'Organization',
          id: resolvedParams.slug,
        }),
      );
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
    };
  });

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error('Internal server error'));
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
