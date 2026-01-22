/**
 * Slack Monitoring Formatters
 *
 * Functions for formatting Slack webhook payloads and event messages.
 */

import type { KnownBlock } from '@slack/web-api';
import type {
  ErrorSeverity,
  EventCategory,
  MonitoringEvent,
  MonitoringEventType,
  SlackMonitoringServiceInterface,
  SlackWebhookPayload,
} from './types';

// =============================================================================
// Event Category Mapping
// =============================================================================

const CATEGORY_MAP: Record<MonitoringEventType, EventCategory> = {
  // Account events
  user_registered: 'accounts',
  organization_created: 'accounts',
  member_invited: 'accounts',
  member_joined: 'accounts',
  invitation_accepted: 'accounts',
  beta_access_requested: 'accounts',
  // Billing events
  subscription_created: 'billing',
  subscription_upgraded: 'billing',
  subscription_downgraded: 'billing',
  subscription_canceled: 'billing',
  payment_succeeded: 'billing',
  payment_failed: 'billing',
  trial_started: 'billing',
  trial_ending: 'billing',
  // Usage events
  video_uploaded: 'usage',
  video_processed: 'usage',
  video_processing_failed: 'usage',
  // Error events
  api_error: 'errors',
  webhook_failed: 'errors',
  integration_error: 'errors',
};

export const getEventCategory = (type: MonitoringEventType): EventCategory => {
  return CATEGORY_MAP[type];
};

// =============================================================================
// Event Emoji and Title Mapping
// =============================================================================

const EMOJI_MAP: Record<MonitoringEventType, string> = {
  user_registered: ':wave:',
  organization_created: ':office:',
  member_invited: ':email:',
  member_joined: ':handshake:',
  invitation_accepted: ':white_check_mark:',
  beta_access_requested: ':raising_hand:',
  subscription_created: ':tada:',
  subscription_upgraded: ':arrow_up:',
  subscription_downgraded: ':arrow_down:',
  subscription_canceled: ':x:',
  payment_succeeded: ':white_check_mark:',
  payment_failed: ':rotating_light:',
  trial_started: ':hourglass_flowing_sand:',
  trial_ending: ':warning:',
  video_uploaded: ':movie_camera:',
  video_processed: ':clapper:',
  video_processing_failed: ':no_entry:',
  api_error: ':bug:',
  webhook_failed: ':broken_heart:',
  integration_error: ':electric_plug:',
};

export const getEventEmoji = (type: MonitoringEventType): string => {
  return EMOJI_MAP[type] || ':bell:';
};

const TITLE_MAP: Record<MonitoringEventType, string> = {
  user_registered: 'New User Registered',
  organization_created: 'New Organization Created',
  member_invited: 'Member Invited',
  member_joined: 'Member Joined Organization',
  invitation_accepted: 'Invitation Accepted',
  beta_access_requested: 'Beta Access Requested',
  subscription_created: 'New Subscription',
  subscription_upgraded: 'Subscription Upgraded',
  subscription_downgraded: 'Subscription Downgraded',
  subscription_canceled: 'Subscription Canceled',
  payment_succeeded: 'Payment Successful',
  payment_failed: 'Payment Failed',
  trial_started: 'Trial Started',
  trial_ending: 'Trial Ending Soon',
  video_uploaded: 'Video Uploaded',
  video_processed: 'Video Processed',
  video_processing_failed: 'Video Processing Failed',
  api_error: 'API Error',
  webhook_failed: 'Webhook Delivery Failed',
  integration_error: 'Integration Error',
};

export const getEventTitle = (type: MonitoringEventType): string => {
  return TITLE_MAP[type] || 'Platform Event';
};

// =============================================================================
// Number Formatters
// =============================================================================

export const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

// =============================================================================
// Error Severity Helpers
// =============================================================================

const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  critical: '#dc2626', // Red
  error: '#f97316', // Orange
  warning: '#eab308', // Yellow
};

export const getSeverityColor = (severity: ErrorSeverity): string => {
  return SEVERITY_COLORS[severity];
};

const SEVERITY_EMOJIS: Record<ErrorSeverity, string> = {
  critical: ':rotating_light:',
  error: ':warning:',
  warning: ':yellow_heart:',
};

export const getSeverityEmoji = (severity: ErrorSeverity): string => {
  return SEVERITY_EMOJIS[severity];
};

const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  critical: 'CRITICAL',
  error: 'ERROR',
  warning: 'WARNING',
};

export const getSeverityLabel = (severity: ErrorSeverity): string => {
  return SEVERITY_LABELS[severity];
};

export const inferSeverityFromStatus = (httpStatus?: number): ErrorSeverity => {
  if (!httpStatus) return 'error';
  if (httpStatus >= 500) return 'critical';
  if (httpStatus >= 400) return 'error';
  return 'warning';
};

export const truncateErrorMessage = (message: string, maxLength: number = 500): string => {
  if (message.length <= maxLength) return message;
  return `${message.substring(0, maxLength)}...`;
};

export const formatStackTrace = (stackTrace: string, maxLines: number = 10): string => {
  const lines = stackTrace.split('\n');
  const truncated = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const remainingLines = lines.length - maxLines;
    truncated.push(`... and ${remainingLines} more lines`);
  }
  return truncated.join('\n');
};

// =============================================================================
// Slack Block Builders
// =============================================================================

export const buildEventBlocks = (event: MonitoringEvent, appUrl: string): KnownBlock[] => {
  const emoji = getEventEmoji(event.type);
  const title = getEventTitle(event.type);

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${title}`,
        emoji: true,
      },
    },
  ];

  // Build context fields based on event type
  const fields: Array<{ type: 'mrkdwn'; text: string }> = [];

  if (event.organizationName) {
    fields.push({
      type: 'mrkdwn',
      text: `*Organization:* ${event.organizationName}`,
    });
  }

  if (event.userName) {
    fields.push({
      type: 'mrkdwn',
      text: `*User:* ${event.userName}`,
    });
  }

  if (event.userEmail) {
    fields.push({
      type: 'mrkdwn',
      text: `*Email:* ${event.userEmail}`,
    });
  }

  // Add event-specific fields
  const data = event.data;

  if (data.planName) {
    fields.push({
      type: 'mrkdwn',
      text: `*Plan:* ${data.planName}`,
    });
  }

  if (data.previousPlan) {
    fields.push({
      type: 'mrkdwn',
      text: `*Previous Plan:* ${data.previousPlan}`,
    });
  }

  if (data.amount && data.currency) {
    fields.push({
      type: 'mrkdwn',
      text: `*Amount:* ${formatCurrency(data.amount as number, data.currency as string)}`,
    });
  }

  if (data.videoTitle) {
    fields.push({
      type: 'mrkdwn',
      text: `*Video:* ${data.videoTitle}`,
    });
  }

  if (data.duration) {
    fields.push({
      type: 'mrkdwn',
      text: `*Duration:* ${formatDuration(data.duration as number)}`,
    });
  }

  if (data.errorMessage) {
    fields.push({
      type: 'mrkdwn',
      text: `*Error:* ${data.errorMessage}`,
    });
  }

  if (data.endpoint) {
    fields.push({
      type: 'mrkdwn',
      text: `*Endpoint:* \`${data.endpoint}\``,
    });
  }

  if (data.trialEndsAt) {
    const trialDate = data.trialEndsAt as Date;
    fields.push({
      type: 'mrkdwn',
      text: `*Trial Ends:* ${trialDate.toLocaleDateString()}`,
    });
  }

  if (data.role) {
    fields.push({
      type: 'mrkdwn',
      text: `*Role:* ${data.role}`,
    });
  }

  if (data.inviterName) {
    fields.push({
      type: 'mrkdwn',
      text: `*Invited By:* ${data.inviterName}`,
    });
  }

  if (data.useCase) {
    fields.push({
      type: 'mrkdwn',
      text: `*Use Case:* ${data.useCase}`,
    });
  }

  if (data.company) {
    fields.push({
      type: 'mrkdwn',
      text: `*Company:* ${data.company}`,
    });
  }

  if (fields.length > 0) {
    blocks.push({
      type: 'section',
      fields,
    });
  }

  // Add timestamp
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<!date^${Math.floor(event.timestamp.getTime() / 1000)}^{date_short_pretty} at {time}|${event.timestamp.toISOString()}>`,
      },
    ],
  } as KnownBlock);

  // Add action buttons for certain events
  if (event.organizationId) {
    const orgUrl = `${appUrl}/admin/organizations/${event.organizationId}`;
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Organization',
            emoji: true,
          },
          url: orgUrl,
          action_id: 'view_organization',
        },
      ],
    });
  }

  return blocks;
};

// Build enhanced error event payload with color-coded attachments
export const buildErrorEventPayload = (
  type: 'api_error' | 'webhook_failed' | 'integration_error',
  data: Parameters<SlackMonitoringServiceInterface['sendErrorEvent']>[1],
  timestamp: Date,
  appUrl: string,
): SlackWebhookPayload => {
  const severity = data.severity || inferSeverityFromStatus(data.httpStatus);
  const severityEmoji = getSeverityEmoji(severity);
  const severityLabel = getSeverityLabel(severity);
  const severityColor = getSeverityColor(severity);
  const title = getEventTitle(type);

  // Header block with severity indicator
  const headerBlocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${severityEmoji} ${title}`,
        emoji: true,
      },
    },
  ];

  // Severity badge as context
  headerBlocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `*Severity:* \`${severityLabel}\`${data.httpStatus ? ` • *Status:* \`${data.httpStatus}\`` : ''}${data.httpMethod ? ` • *Method:* \`${data.httpMethod}\`` : ''}`,
      },
    ],
  } as KnownBlock);

  // Main error details in attachment (with color bar)
  const attachmentBlocks: KnownBlock[] = [];

  // Error message section with better formatting
  if (data.errorMessage) {
    const truncatedMessage = truncateErrorMessage(data.errorMessage);
    attachmentBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Error Message:*\n\`\`\`${truncatedMessage}\`\`\``,
      },
    } as KnownBlock);
  }

  // Context fields in a structured grid
  const contextFields: Array<{ type: 'mrkdwn'; text: string }> = [];

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

  // Stack trace in collapsible section (using code block)
  if (data.stackTrace) {
    const formattedStack = formatStackTrace(data.stackTrace);
    attachmentBlocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Stack Trace:*\n\`\`\`${formattedStack}\`\`\``,
      },
    } as KnownBlock);
  }

  // Timestamp
  attachmentBlocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<!date^${Math.floor(timestamp.getTime() / 1000)}^{date_short_pretty} at {time}|${timestamp.toISOString()}>`,
      },
    ],
  } as KnownBlock);

  // Action buttons
  const actionElements: Array<{
    type: 'button';
    text: { type: 'plain_text'; text: string; emoji?: boolean };
    url: string;
    action_id: string;
  }> = [];

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
  const fallbackText = `${severityEmoji} [${severityLabel}] ${title}: ${truncateErrorMessage(data.errorMessage, 100)}`;

  return {
    text: fallbackText,
    blocks: headerBlocks,
    attachments: [
      {
        color: severityColor,
        blocks: attachmentBlocks,
        fallback: fallbackText,
      },
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
};
