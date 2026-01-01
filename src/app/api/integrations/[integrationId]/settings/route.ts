import { Cause, Effect, Exit, Layer, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { DatabaseLive } from "@/lib/effect/services/database";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const SettingsLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive);

interface UpdateSettingsRequest {
  autoImport?: boolean;
  notifyOnNewRecording?: boolean;
  importMinDuration?: number;
}

// =============================================================================
// PATCH /api/integrations/[integrationId]/settings - Update integration settings
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ integrationId: string }> }) {
  const { integrationId } = await params;

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: UpdateSettingsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;

    // Get the integration first to verify ownership
    const integration = yield* integrationRepo.getIntegration(integrationId);

    // Verify the user owns this integration
    if (integration.userId !== session.user.id) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You don't have permission to update this integration",
        }),
      );
    }

    // Merge new settings with existing metadata
    // Note: We extend the base metadata type with additional settings fields
    const currentMetadata = (integration.metadata || {}) as Record<string, unknown>;
    const updatedMetadata = {
      ...currentMetadata,
      ...(body.autoImport !== undefined && { autoImport: body.autoImport }),
      ...(body.notifyOnNewRecording !== undefined && { notifyOnNewRecording: body.notifyOnNewRecording }),
      ...(body.importMinDuration !== undefined && { importMinDuration: body.importMinDuration }),
    };

    // Update the integration - cast to expected type as we're extending the schema
    yield* integrationRepo.updateIntegration(integrationId, {
      metadata: updatedMetadata as { email?: string; accountId?: string; scope?: string },
    });

    return { success: true };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, SettingsLayer));

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
      return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
    },
    onSuccess: () => {
      return NextResponse.json({ success: true });
    },
  });
}

// =============================================================================
// GET /api/integrations/[integrationId]/settings - Get integration settings
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ integrationId: string }> }) {
  const { integrationId } = await params;

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;

    // Get the integration
    const integration = yield* integrationRepo.getIntegration(integrationId);

    // Verify the user owns this integration
    if (integration.userId !== session.user.id) {
      return yield* Effect.fail(
        new UnauthorizedError({
          message: "You don't have permission to view this integration",
        }),
      );
    }

    const metadata = (integration.metadata as Record<string, unknown>) || {};

    return {
      autoImport: metadata.autoImport ?? false,
      notifyOnNewRecording: metadata.notifyOnNewRecording ?? true,
      importMinDuration: metadata.importMinDuration ?? 5,
    };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, SettingsLayer));

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
      return NextResponse.json({ success: false, error: "Failed to get settings" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
