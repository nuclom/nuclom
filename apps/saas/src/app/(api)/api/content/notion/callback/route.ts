/**
 * Notion Content OAuth Callback
 *
 * GET /api/content/notion/callback - Handle OAuth callback and create content source
 */

import { Effect } from 'effect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createFullLayer } from '@nuclom/lib/api-handler';
import {
  ContentRepository,
  NotionContentAdapter,
  exchangeNotionCode,
} from '@nuclom/lib/effect/services/content';
import { logger } from '@nuclom/lib/logger';

interface OAuthState {
  userId: string;
  organizationId: string;
  timestamp: number;
  type: string;
}

function parseOAuthState(state: string): OAuthState | null {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  await connection();

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors from Notion
  if (error) {
    logger.error('[Notion Content OAuth Error]', { error });
    return redirect('/settings/integrations?error=notion_content_oauth_failed');
  }

  // Validate required parameters
  if (!code || !state) {
    return redirect('/settings/integrations?error=notion_content_invalid_response');
  }

  // Verify state matches stored cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get('notion_content_oauth_state')?.value;

  if (!storedState || storedState !== state) {
    return redirect('/settings/integrations?error=notion_content_state_mismatch');
  }

  // Clear the state cookie
  cookieStore.delete('notion_content_oauth_state');

  // Parse state
  const parsedState = parseOAuthState(state);
  if (!parsedState || parsedState.type !== 'content') {
    return redirect('/settings/integrations?error=notion_content_invalid_state');
  }

  // Verify state is not expired (10 minutes)
  if (Date.now() - parsedState.timestamp > 600000) {
    return redirect('/settings/integrations?error=notion_content_state_expired');
  }

  const { userId, organizationId } = parsedState;

  const effect = Effect.gen(function* () {
    const notionAdapter = yield* NotionContentAdapter;
    const contentRepo = yield* ContentRepository;

    // Exchange code for tokens
    const tokens = yield* exchangeNotionCode(code);

    // Create or update content source
    const existingSources = yield* contentRepo.getSources({
      organizationId,
      type: 'notion',
    });

    const existingSource = existingSources.find(
      (s) => s.credentials && (s.credentials as { workspaceId?: string }).workspaceId === tokens.workspace_id,
    );

    if (existingSource) {
      // Update existing source
      yield* contentRepo.updateSource(existingSource.id, {
        credentials: {
          accessToken: tokens.access_token,
        },
      });
    } else {
      // Create new content source
      yield* contentRepo.createSource({
        organizationId,
        type: 'notion',
        name: `Notion - ${tokens.workspace_name}`,
        credentials: {
          accessToken: tokens.access_token,
        },
        config: {
          settings: {
            workspaceId: tokens.workspace_id,
            workspaceName: tokens.workspace_name,
            workspaceIcon: tokens.workspace_icon,
            botId: tokens.bot_id,
            ownerId: tokens.owner?.user?.id,
            ownerType: tokens.owner?.type,
          },
        },
      });
    }

    return { success: true };
  });

  try {
    await Effect.runPromise(Effect.provide(effect, createFullLayer()));
    return redirect(`/org/${organizationId}/settings/integrations?success=notion_content`);
  } catch (err) {
    logger.error('[Notion Content Callback Error]', err instanceof Error ? err : new Error(String(err)));
    return redirect(`/org/${organizationId}/settings/integrations?error=notion_content_callback_failed`);
  }
}
