import { type NextRequest, NextResponse } from "next/server";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { auth } from "@/lib/auth";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { DatabaseError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/effect/errors";

export const dynamic = "force-dynamic";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const IntegrationsLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive);

// =============================================================================
// GET /api/integrations - List integrations for the current user
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!organizationId) {
    return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
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

  const exit = await Effect.runPromiseExit(Effect.provide(effect, IntegrationsLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        console.error("[Integrations Error]", error.value);
      }
      return NextResponse.json({ success: false, error: "Failed to fetch integrations" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}

// =============================================================================
// DELETE /api/integrations - Disconnect an integration
// =============================================================================

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("id");

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!integrationId) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
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

    return { success: true };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, IntegrationsLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 404 });
        }
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 403 });
        }
      }
      return NextResponse.json({ success: false, error: "Failed to delete integration" }, { status: 500 });
    },
    onSuccess: () => {
      return NextResponse.json({ success: true });
    },
  });
}
