import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit } from '@/lib/api-handler';
import { Auth } from '@/lib/effect/services/auth';
import { Billing } from '@/lib/effect/services/billing';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { getAppUrl } from '@/lib/env/server';
import { rateLimitBillingAsync } from '@/lib/rate-limit';
import { validateRequestBody } from '@/lib/validation';

const PortalRequestSchema = Schema.Struct({
  organizationId: Schema.String,
});

// =============================================================================
// POST /api/billing/portal - Create Stripe billing portal session
// =============================================================================

export async function POST(request: NextRequest) {
  // Rate limit billing operations to prevent abuse
  const rateLimitResult = await rateLimitBillingAsync(request);
  if (rateLimitResult) return rateLimitResult;

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse and validate body
    const { organizationId } = yield* validateRequestBody(PortalRequestSchema, request);

    // Verify user is member of organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Get organization for slug
    const org = yield* orgRepo.getOrganization(organizationId);

    // Build return URL
    const baseUrl = request.headers.get('origin') || getAppUrl();
    const returnUrl = `${baseUrl}/${org.slug}/settings/billing`;

    // Create portal session
    const billing = yield* Billing;
    const result = yield* billing.createPortalSession(organizationId, returnUrl);

    return result;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
