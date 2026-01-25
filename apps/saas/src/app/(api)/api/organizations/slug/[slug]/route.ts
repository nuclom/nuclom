import { handleEffectExit, runPublicApiEffect } from '@nuclom/lib/api-handler';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// GET /api/organizations/slug/[slug] - Get organization by slug
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);

    const orgRepo = yield* OrganizationRepository;
    const organization = yield* orgRepo.getOrganizationBySlug(resolvedParams.slug);

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
    };
  });

  const exit = await runPublicApiEffect(effect);
  return handleEffectExit(exit);
}
