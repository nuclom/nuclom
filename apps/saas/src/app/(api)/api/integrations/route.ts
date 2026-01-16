import { Effect } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { handleEffectExit, runApiEffect } from '@/lib/api-handler';
import { auth } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/effect/errors';
import { IntegrationRepository } from '@/lib/effect/services/integration-repository';

// =============================================================================
// GET /api/integrations - List integrations for the current user
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const integrations = yield* integrationRepo.getUserIntegrations(session.user.id, organizationId);

    // Return integrations without sensitive tokens
    return integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      connected: true,
      expiresAt: integration.expiresAt,
      metadata: integration.metadata,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }));
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/integrations - Disconnect an integration
// =============================================================================

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get('id');

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!integrationId) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;

    // Get the integration first to verify ownership
    const integration = yield* integrationRepo.getIntegration(integrationId);

    // Verify the user owns this integration
    if (integration.userId !== session.user.id) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You don't have permission to delete this integration",
        }),
      );
    }

    // Delete the integration
    yield* integrationRepo.deleteIntegration(integrationId);

    return { deleted: true };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
