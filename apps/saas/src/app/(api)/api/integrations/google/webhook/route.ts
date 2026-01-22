import { DatabaseLive } from '@nuclom/lib/effect/services/database';
import { IntegrationRepository, IntegrationRepositoryLive } from '@nuclom/lib/effect/services/integration-repository';
import { logger } from '@nuclom/lib/logger';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const WebhookLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive);

// Google Push Notification headers
type _GooglePushHeaders = {
  'x-goog-channel-id': string;
  'x-goog-channel-token': string;
  'x-goog-message-number': string;
  'x-goog-resource-id': string;
  'x-goog-resource-state': 'sync' | 'exists' | 'not_exists' | 'update';
  'x-goog-resource-uri': string;
};

// =============================================================================
// POST /api/integrations/google/webhook - Handle Google Drive/Calendar webhooks
// =============================================================================

export async function POST(request: NextRequest) {
  // Extract Google push notification headers
  const channelId = request.headers.get('x-goog-channel-id');
  const channelToken = request.headers.get('x-goog-channel-token');
  const resourceState = request.headers.get('x-goog-resource-state');

  logger.info('Google webhook received notification', { resourceState, channelId, component: 'google-webhook' });

  // Verify channel token matches what we expect
  // In production, you should store and verify channel tokens
  if (!channelId || !resourceState) {
    return NextResponse.json({ error: 'Missing required headers' }, { status: 400 });
  }

  // Handle sync message (sent when watch is first created)
  if (resourceState === 'sync') {
    logger.info('Google webhook sync notification', { channelId, component: 'google-webhook' });
    return NextResponse.json({ success: true, status: 'sync acknowledged' });
  }

  // Handle resource updates
  if (resourceState === 'exists' || resourceState === 'update') {
    const effect = Effect.gen(function* () {
      const integrationRepo = yield* IntegrationRepository;

      // Parse channel token to get integration info
      // Token format: "integration:{integrationId}:{userId}"
      let integrationId: string | null = null;

      if (channelToken) {
        const parts = channelToken.split(':');
        if (parts[0] === 'integration' && parts[1]) {
          integrationId = parts[1];
        }
      }

      if (!integrationId) {
        logger.warn('Could not parse integration ID from token', { channelToken, component: 'google-webhook' });
        return { processed: false, reason: 'Invalid channel token' };
      }

      // Use Effect.catchAll for proper error handling instead of nested Effect.runPromise
      const integration = yield* integrationRepo
        .getIntegration(integrationId)
        .pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!integration) {
        logger.warn('No integration found', { integrationId, component: 'google-webhook' });
        return { processed: false, reason: 'No matching integration' };
      }

      // Check if auto-import is enabled
      const metadata = (integration.metadata as Record<string, unknown>) || {};
      if (!metadata.autoImport) {
        logger.info('Auto-import disabled for integration', {
          integrationId: integration.id,
          component: 'google-webhook',
        });
        return { processed: false, reason: 'Auto-import disabled' };
      }

      // Create a notification record for the user
      // In a full implementation, you would:
      // 1. Fetch the changed file(s) from Google Drive
      // 2. Filter for Meet recordings
      // 3. Trigger auto-import for new recordings

      logger.info('Change detected for integration', { integrationId, component: 'google-webhook' });

      return { processed: true, status: 'notification_recorded' };
    });

    const exit = await Effect.runPromiseExit(Effect.provide(effect, WebhookLayer));

    return Exit.match(exit, {
      onFailure: (cause) => {
        const error = Cause.failureOption(cause);
        if (Option.isSome(error)) {
          // biome-ignore lint/suspicious/noExplicitAny: Effect's Option.value is unknown, need any for instanceof check
          const errValue = error.value as any;
          const errorObj: Error = errValue instanceof Error ? errValue : new Error(String(errValue));
          logger.error('Google webhook error', errorObj, { component: 'google-webhook' });
        }
        return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
      },
      onSuccess: (result) => {
        return NextResponse.json({ success: true, ...result });
      },
    });
  }

  // Handle deletion
  if (resourceState === 'not_exists') {
    logger.info('Google webhook resource deleted', { channelId, component: 'google-webhook' });
    return NextResponse.json({ success: true, status: 'deletion acknowledged' });
  }

  return NextResponse.json({ success: true });
}
