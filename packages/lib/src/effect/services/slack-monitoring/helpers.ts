/**
 * Slack Monitoring Helpers
 *
 * Effect helper functions and standalone notification functions.
 */

import { Effect } from 'effect';
import { env, getAppUrl } from '../../../env/server';
import { createLogger } from '../../../logger';
import {
  formatCurrency,
  formatStackTrace,
  getEventCategory,
  getEventEmoji,
  getEventTitle,
  getSeverityColor,
  getSeverityEmoji,
  getSeverityLabel,
  inferSeverityFromStatus,
  truncateErrorMessage,
} from './formatters';
import { SlackMonitoring } from './service';
import type {
  EventCategory,
  MonitoringEvent,
  MonitoringEventType,
  SlackBlock,
  SlackMonitoringServiceInterface,
  SlackWebhookPayload,
} from './types';

const log = createLogger('slack-monitoring');

// =============================================================================
// Effect Helper Functions
// =============================================================================

export const sendSlackMonitoringEvent = (event: MonitoringEvent): Effect.Effect<void, Error, SlackMonitoring> =>
  Effect.gen(function* () {
    const service = yield* SlackMonitoring;
    return yield* service.sendEvent(event);
  });

export const sendSlackAccountEvent = (
  type:
    | 'user_registered'
    | 'organization_created'
    | 'member_invited'
    | 'member_joined'
    | 'invitation_accepted'
    | 'beta_access_requested',
  data: Parameters<SlackMonitoringServiceInterface['sendAccountEvent']>[1],
): Effect.Effect<void, Error, SlackMonitoring> =>
  Effect.gen(function* () {
    const service = yield* SlackMonitoring;
    return yield* service.sendAccountEvent(type, data);
  });

export const sendSlackBillingEvent = (
  type: Parameters<SlackMonitoringServiceInterface['sendBillingEvent']>[0],
  data: Parameters<SlackMonitoringServiceInterface['sendBillingEvent']>[1],
): Effect.Effect<void, Error, SlackMonitoring> =>
  Effect.gen(function* () {
    const service = yield* SlackMonitoring;
    return yield* service.sendBillingEvent(type, data);
  });

export const sendSlackVideoEvent = (
  type: 'video_uploaded' | 'video_processed' | 'video_processing_failed',
  data: Parameters<SlackMonitoringServiceInterface['sendVideoEvent']>[1],
): Effect.Effect<void, Error, SlackMonitoring> =>
  Effect.gen(function* () {
    const service = yield* SlackMonitoring;
    return yield* service.sendVideoEvent(type, data);
  });

export const sendSlackErrorEvent = (
  type: 'api_error' | 'webhook_failed' | 'integration_error',
  data: Parameters<SlackMonitoringServiceInterface['sendErrorEvent']>[1],
): Effect.Effect<void, Error, SlackMonitoring> =>
  Effect.gen(function* () {
    const service = yield* SlackMonitoring;
    return yield* service.sendErrorEvent(type, data);
  });

// =============================================================================
// Standalone Functions (for use outside Effect contexts)
// =============================================================================

/**
 * Get webhook URL for a specific category from environment
 */
function getWebhookUrlForCategory(category: EventCategory): string | null {
  // Use process.env directly for standalone function
  const categoryMap: Record<EventCategory, string | undefined> = {
    accounts: env.SLACK_MONITORING_WEBHOOK_ACCOUNTS,
    billing: env.SLACK_MONITORING_WEBHOOK_BILLING,
    usage: env.SLACK_MONITORING_WEBHOOK_USAGE,
    errors: env.SLACK_MONITORING_WEBHOOK_ERRORS,
  };

  // Try category-specific first, then fall back to default
  return categoryMap[category] || env.SLACK_MONITORING_WEBHOOK_URL || null;
}

/**
 * Build enhanced error payload for standalone function
 */
function buildStandaloneErrorPayload(
  type: 'api_error' | 'webhook_failed' | 'integration_error',
  data: Parameters<typeof notifySlackMonitoring>[1],
): SlackWebhookPayload {
  const appUrl = getAppUrl();
  const severity = data.severity || inferSeverityFromStatus(data.httpStatus);
  const severityEmoji = getSeverityEmoji(severity);
  const severityLabel = getSeverityLabel(severity);
  const severityColor = getSeverityColor(severity);
  const title = getEventTitle(type);

  // Header block with severity indicator
  const headerBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${severityEmoji} ${title}`,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Severity:* \`${severityLabel}\`${data.httpStatus ? ` • *Status:* \`${data.httpStatus}\`` : ''}${data.httpMethod ? ` • *Method:* \`${data.httpMethod}\`` : ''}`,
        },
      ],
    },
  ];

  // Main error details in attachment (with color bar)
  const attachmentBlocks: Array<Record<string, unknown>> = [];

  // Error message section with better formatting
  if (data.errorMessage) {
    const truncatedMessage = truncateErrorMessage(String(data.errorMessage));
    attachmentBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error Message:*\n\`\`\`${truncatedMessage}\`\`\``,
      },
    });
  }

  // Context fields in a structured grid
  const contextFields: Array<{ type: string; text: string }> = [];

  if (data.endpoint) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Endpoint:*\n\`${data.endpoint}\``,
    });
  }

  if (data.errorCode) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Error Code:*\n\`${data.errorCode}\``,
    });
  }

  if (data.requestId) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Request ID:*\n\`${data.requestId}\``,
    });
  }

  if (data.integrationName) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Integration:*\n${data.integrationName}`,
    });
  }

  if (data.webhookType) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Webhook Type:*\n${data.webhookType}`,
    });
  }

  if (data.organizationName) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Organization:*\n${data.organizationName}`,
    });
  }

  if (data.userName || data.userEmail) {
    const userInfo = data.userName
      ? data.userEmail
        ? `${data.userName} (${data.userEmail})`
        : data.userName
      : data.userEmail;
    contextFields.push({
      type: 'mrkdwn',
      text: `*User:*\n${userInfo}`,
    });
  }

  if (data.videoTitle) {
    contextFields.push({
      type: 'mrkdwn',
      text: `*Video:*\n${data.videoTitle}`,
    });
  }

  if (contextFields.length > 0) {
    attachmentBlocks.push({
      type: 'section',
      fields: contextFields,
    });
  }

  // Stack trace in code block
  if (data.stackTrace) {
    const formattedStack = formatStackTrace(String(data.stackTrace));
    attachmentBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Stack Trace:*\n\`\`\`${formattedStack}\`\`\``,
      },
    });
  }

  // Timestamp
  attachmentBlocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
      },
    ],
  });

  // Action buttons
  const actionElements: Array<Record<string, unknown>> = [];

  if (data.organizationId) {
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Organization',
        emoji: true,
      },
      url: `${appUrl}/admin/organizations/${data.organizationId}`,
      action_id: 'view_organization',
    });
  }

  if (data.userId) {
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View User',
        emoji: true,
      },
      url: `${appUrl}/admin/users/${data.userId}`,
      action_id: 'view_user',
    });
  }

  if (data.videoId) {
    actionElements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Video',
        emoji: true,
      },
      url: `${appUrl}/admin/videos/${data.videoId}`,
      action_id: 'view_video',
    });
  }

  if (actionElements.length > 0) {
    attachmentBlocks.push({
      type: 'actions',
      elements: actionElements,
    });
  }

  // Build the fallback text
  const errorMsg = data.errorMessage ? truncateErrorMessage(String(data.errorMessage), 100) : 'Unknown error';
  const fallbackText = `${severityEmoji} [${severityLabel}] ${title}: ${errorMsg}`;

  return {
    text: fallbackText,
    blocks: headerBlocks as SlackBlock[],
    attachments: [
      {
        color: severityColor,
        blocks: attachmentBlocks as unknown as SlackBlock[],
        fallback: fallbackText,
      },
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
}

/**
 * Send a Slack monitoring event directly (without Effect context)
 * Use this in contexts where Effect is not available, such as better-auth hooks
 */
export async function notifySlackMonitoring(
  type: MonitoringEventType,
  data: {
    organizationId?: string;
    organizationName?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    planName?: string;
    amount?: number;
    currency?: string;
    errorMessage?: string;
    useCase?: string;
    company?: string;
    invitationEmail?: string;
    // Error-specific fields
    errorCode?: string;
    endpoint?: string;
    httpStatus?: number;
    httpMethod?: string;
    requestId?: string;
    severity?: 'critical' | 'error' | 'warning';
    stackTrace?: string;
    webhookType?: string;
    integrationName?: string;
    videoId?: string;
    videoTitle?: string;
    [key: string]: unknown;
  },
): Promise<void> {
  try {
    // Get webhook URL from environment - support category-specific channels
    const category = getEventCategory(type);
    const webhookUrl = getWebhookUrlForCategory(category);

    if (!webhookUrl) {
      return; // Silently skip if not configured
    }

    // Use enhanced formatting for error events (including video processing failures with error messages)
    const isErrorEvent =
      type === 'api_error' ||
      type === 'webhook_failed' ||
      type === 'integration_error' ||
      type === 'video_processing_failed';
    if (isErrorEvent && data.errorMessage) {
      const payload = buildStandaloneErrorPayload(type as 'api_error' | 'webhook_failed' | 'integration_error', data);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        log.warn('Slack webhook failed', { status: response.status });
      }
      return;
    }

    // Standard formatting for non-error events
    const emoji = getEventEmoji(type);
    const title = getEventTitle(type);

    // Build simple block message
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
    ];

    // Build fields
    const fields: Array<{ type: string; text: string }> = [];

    if (data.organizationName) {
      fields.push({ type: 'mrkdwn', text: `*Organization:* ${data.organizationName}` });
    }
    if (data.userName) {
      fields.push({ type: 'mrkdwn', text: `*User:* ${data.userName}` });
    }
    if (data.userEmail) {
      fields.push({ type: 'mrkdwn', text: `*Email:* ${data.userEmail}` });
    }
    if (data.planName) {
      fields.push({ type: 'mrkdwn', text: `*Plan:* ${data.planName}` });
    }
    if (data.amount && data.currency) {
      fields.push({
        type: 'mrkdwn',
        text: `*Amount:* ${formatCurrency(data.amount, data.currency)}`,
      });
    }
    if (data.errorMessage) {
      fields.push({ type: 'mrkdwn', text: `*Error:* ${data.errorMessage}` });
    }
    if (data.useCase) {
      fields.push({ type: 'mrkdwn', text: `*Use Case:* ${data.useCase}` });
    }
    if (data.company) {
      fields.push({ type: 'mrkdwn', text: `*Company:* ${data.company}` });
    }

    if (fields.length > 0) {
      blocks.push({
        type: 'section',
        fields,
      } as unknown as (typeof blocks)[0]);
    }

    // Add timestamp
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
        },
      ],
    } as unknown as (typeof blocks)[0]);

    const payload = {
      text: `${emoji} ${title}${data.organizationName ? ` - ${data.organizationName}` : ''}`,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      log.warn('Slack webhook failed', { status: response.status });
    }
  } catch (error) {
    // Log but don't throw - monitoring should never break the app
    log.warn('Failed to send Slack notification', { error: String(error) });
  }
}
