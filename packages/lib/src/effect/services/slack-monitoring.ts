/**
 * Slack Monitoring Service using Effect-TS
 *
 * Provides platform event monitoring via Slack webhooks.
 * Sends notifications for account creation, billing events, platform usage, and errors.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { env, getAppUrl } from '../../env/server';

// =============================================================================
// Types
// =============================================================================

export type MonitoringEventType =
  // Account events
  | 'user_registered'
  | 'organization_created'
  | 'member_invited'
  | 'member_joined'
  | 'invitation_accepted'
  | 'beta_access_requested'
  // Billing events
  | 'subscription_created'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_canceled'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'trial_started'
  | 'trial_ending'
  // Platform usage
  | 'video_uploaded'
  | 'video_processed'
  | 'video_processing_failed'
  // Error events
  | 'api_error'
  | 'webhook_failed'
  | 'integration_error';

export interface MonitoringEvent {
  readonly type: MonitoringEventType;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
  readonly organizationId?: string;
  readonly organizationName?: string;
  readonly userId?: string;
  readonly userName?: string;
  readonly userEmail?: string;
}

interface SlackTextElement {
  readonly type: string;
  readonly text?:
    | string
    | {
        readonly type: string;
        readonly text: string;
        readonly emoji?: boolean;
      };
  readonly url?: string;
  readonly action_id?: string;
}

interface SlackBlock {
  readonly type: string;
  readonly text?: {
    readonly type: string;
    readonly text: string;
    readonly emoji?: boolean;
  };
  readonly fields?: Array<{
    readonly type: string;
    readonly text: string;
  }>;
  readonly elements?: SlackTextElement[];
}

interface SlackAttachment {
  readonly color?: string;
  readonly blocks?: SlackBlock[];
  readonly fallback?: string;
}

interface SlackWebhookPayload {
  readonly text: string;
  readonly blocks?: SlackBlock[];
  readonly attachments?: SlackAttachment[];
  readonly unfurl_links?: boolean;
  readonly unfurl_media?: boolean;
}

// =============================================================================
// Slack Monitoring Service Interface
// =============================================================================

export interface SlackMonitoringServiceInterface {
  /**
   * Check if the Slack monitoring is configured
   */
  readonly isConfigured: boolean;

  /**
   * Send a monitoring event to Slack
   */
  readonly sendEvent: (event: MonitoringEvent) => Effect.Effect<void, Error>;

  /**
   * Send an account event (user registration, organization creation)
   */
  readonly sendAccountEvent: (
    type:
      | 'user_registered'
      | 'organization_created'
      | 'member_invited'
      | 'member_joined'
      | 'invitation_accepted'
      | 'beta_access_requested',
    data: {
      userId?: string;
      userName?: string;
      userEmail?: string;
      organizationId?: string;
      organizationName?: string;
      inviterName?: string;
      invitationEmail?: string;
      role?: string;
      useCase?: string;
      company?: string;
    },
  ) => Effect.Effect<void, Error>;

  /**
   * Send a billing event
   */
  readonly sendBillingEvent: (
    type:
      | 'subscription_created'
      | 'subscription_upgraded'
      | 'subscription_downgraded'
      | 'subscription_canceled'
      | 'payment_succeeded'
      | 'payment_failed'
      | 'trial_started'
      | 'trial_ending',
    data: {
      organizationId: string;
      organizationName: string;
      planName?: string;
      previousPlan?: string;
      amount?: number;
      currency?: string;
      trialEndsAt?: Date;
      failureReason?: string;
    },
  ) => Effect.Effect<void, Error>;

  /**
   * Send a video event
   */
  readonly sendVideoEvent: (
    type: 'video_uploaded' | 'video_processed' | 'video_processing_failed',
    data: {
      videoId: string;
      videoTitle: string;
      organizationId?: string;
      organizationName?: string;
      userId?: string;
      userName?: string;
      duration?: number;
      errorMessage?: string;
    },
  ) => Effect.Effect<void, Error>;

  /**
   * Send an error event
   */
  readonly sendErrorEvent: (
    type: 'api_error' | 'webhook_failed' | 'integration_error',
    data: {
      errorMessage: string;
      errorCode?: string;
      endpoint?: string;
      webhookType?: string;
      integrationName?: string;
      organizationId?: string;
      organizationName?: string;
      userId?: string;
      userName?: string;
      userEmail?: string;
      stackTrace?: string;
      httpStatus?: number;
      httpMethod?: string;
      requestId?: string;
      severity?: 'critical' | 'error' | 'warning';
      videoId?: string;
      videoTitle?: string;
    },
  ) => Effect.Effect<void, Error>;
}

// =============================================================================
// Slack Monitoring Service Tag
// =============================================================================

export class SlackMonitoring extends Context.Tag('SlackMonitoring')<
  SlackMonitoring,
  SlackMonitoringServiceInterface
>() {}

// =============================================================================
// Event Categories
// =============================================================================

type EventCategory = 'accounts' | 'billing' | 'usage' | 'errors';

const getEventCategory = (type: MonitoringEventType): EventCategory => {
  const categoryMap: Record<MonitoringEventType, EventCategory> = {
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
  return categoryMap[type];
};

// =============================================================================
// Configuration
// =============================================================================

const SlackMonitoringConfigEffect = Config.all({
  // Default webhook (fallback for all events)
  defaultWebhook: Config.string('SLACK_MONITORING_WEBHOOK_URL').pipe(Config.option),
  // Channel-specific webhooks
  accountsWebhook: Config.string('SLACK_MONITORING_WEBHOOK_ACCOUNTS').pipe(Config.option),
  billingWebhook: Config.string('SLACK_MONITORING_WEBHOOK_BILLING').pipe(Config.option),
  usageWebhook: Config.string('SLACK_MONITORING_WEBHOOK_USAGE').pipe(Config.option),
  errorsWebhook: Config.string('SLACK_MONITORING_WEBHOOK_ERRORS').pipe(Config.option),
});

// =============================================================================
// Event Formatters
// =============================================================================

const getEventEmoji = (type: MonitoringEventType): string => {
  const emojiMap: Record<MonitoringEventType, string> = {
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
  return emojiMap[type] || ':bell:';
};

const getEventTitle = (type: MonitoringEventType): string => {
  const titleMap: Record<MonitoringEventType, string> = {
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
  return titleMap[type] || 'Platform Event';
};

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

const formatDuration = (seconds: number): string => {
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

type ErrorSeverity = 'critical' | 'error' | 'warning';

const getSeverityColor = (severity: ErrorSeverity): string => {
  const colorMap: Record<ErrorSeverity, string> = {
    critical: '#dc2626', // Red
    error: '#f97316', // Orange
    warning: '#eab308', // Yellow
  };
  return colorMap[severity];
};

const getSeverityEmoji = (severity: ErrorSeverity): string => {
  const emojiMap: Record<ErrorSeverity, string> = {
    critical: ':rotating_light:',
    error: ':warning:',
    warning: ':yellow_heart:',
  };
  return emojiMap[severity];
};

const getSeverityLabel = (severity: ErrorSeverity): string => {
  const labelMap: Record<ErrorSeverity, string> = {
    critical: 'CRITICAL',
    error: 'ERROR',
    warning: 'WARNING',
  };
  return labelMap[severity];
};

const inferSeverityFromStatus = (httpStatus?: number): ErrorSeverity => {
  if (!httpStatus) return 'error';
  if (httpStatus >= 500) return 'critical';
  if (httpStatus >= 400) return 'error';
  return 'warning';
};

const truncateErrorMessage = (message: string, maxLength: number = 500): string => {
  if (message.length <= maxLength) return message;
  return `${message.substring(0, maxLength)}...`;
};

const formatStackTrace = (stackTrace: string, maxLines: number = 10): string => {
  const lines = stackTrace.split('\n');
  const truncated = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const remainingLines = lines.length - maxLines;
    truncated.push(`... and ${remainingLines} more lines`);
  }
  return truncated.join('\n');
};

// =============================================================================
// Slack Monitoring Service Implementation
// =============================================================================

const makeSlackMonitoringService = Effect.gen(function* () {
  const config = yield* SlackMonitoringConfigEffect;

  // Check if any webhook is configured
  const hasDefaultWebhook = Option.isSome(config.defaultWebhook);
  const hasAccountsWebhook = Option.isSome(config.accountsWebhook);
  const hasBillingWebhook = Option.isSome(config.billingWebhook);
  const hasUsageWebhook = Option.isSome(config.usageWebhook);
  const hasErrorsWebhook = Option.isSome(config.errorsWebhook);
  const isConfigured =
    hasDefaultWebhook || hasAccountsWebhook || hasBillingWebhook || hasUsageWebhook || hasErrorsWebhook;

  const appUrl = getAppUrl();

  // Get the appropriate webhook URL for an event category
  const getWebhookUrl = (category: EventCategory): string | null => {
    // Helper to safely get webhook URL or fall back to default
    const getWithFallback = (categoryOption: Option.Option<string>): string | null => {
      if (Option.isSome(categoryOption)) {
        return categoryOption.value;
      }
      if (Option.isSome(config.defaultWebhook)) {
        return config.defaultWebhook.value;
      }
      return null;
    };

    switch (category) {
      case 'accounts':
        return getWithFallback(config.accountsWebhook);
      case 'billing':
        return getWithFallback(config.billingWebhook);
      case 'usage':
        return getWithFallback(config.usageWebhook);
      case 'errors':
        return getWithFallback(config.errorsWebhook);
      default:
        return Option.isSome(config.defaultWebhook) ? config.defaultWebhook.value : null;
    }
  };

  const sendWebhook = (payload: SlackWebhookPayload, webhookUrl: string): Effect.Effect<void, Error> =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Slack webhook failed: ${response.status} - ${text}`);
        }
      },
      catch: (error) =>
        new Error(`Failed to send Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`),
    });

  const buildEventBlocks = (event: MonitoringEvent): SlackBlock[] => {
    const emoji = getEventEmoji(event.type);
    const title = getEventTitle(event.type);

    const blocks: SlackBlock[] = [
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
    const fields: Array<{ type: string; text: string }> = [];

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
    } as SlackBlock);

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
  const buildErrorEventPayload = (
    type: 'api_error' | 'webhook_failed' | 'integration_error',
    data: Parameters<SlackMonitoringServiceInterface['sendErrorEvent']>[1],
    timestamp: Date,
  ): SlackWebhookPayload => {
    const severity = data.severity || inferSeverityFromStatus(data.httpStatus);
    const severityEmoji = getSeverityEmoji(severity);
    const severityLabel = getSeverityLabel(severity);
    const severityColor = getSeverityColor(severity);
    const title = getEventTitle(type);

    // Header block with severity indicator
    const headerBlocks: SlackBlock[] = [
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
    } as SlackBlock);

    // Main error details in attachment (with color bar)
    const attachmentBlocks: SlackBlock[] = [];

    // Error message section with better formatting
    if (data.errorMessage) {
      const truncatedMessage = truncateErrorMessage(data.errorMessage);
      attachmentBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n\`\`\`${truncatedMessage}\`\`\``,
        },
      } as SlackBlock);
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

    // Stack trace in collapsible section (using code block)
    if (data.stackTrace) {
      const formattedStack = formatStackTrace(data.stackTrace);
      attachmentBlocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`${formattedStack}\`\`\``,
        },
      } as SlackBlock);
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
    } as SlackBlock);

    // Action buttons
    const actionElements: SlackTextElement[] = [];

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

  const sendEvent = (event: MonitoringEvent): Effect.Effect<void, Error> => {
    // Get the webhook URL for this event category
    const category = getEventCategory(event.type);
    const webhookUrl = getWebhookUrl(category);

    // Skip if no webhook configured for this category
    if (!webhookUrl) {
      return Effect.succeed(undefined);
    }

    const blocks = buildEventBlocks(event);
    const fallbackText = `${getEventEmoji(event.type)} ${getEventTitle(event.type)}${event.organizationName ? ` - ${event.organizationName}` : ''}`;

    return sendWebhook(
      {
        text: fallbackText,
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      },
      webhookUrl,
    );
  };

  const sendAccountEvent: SlackMonitoringServiceInterface['sendAccountEvent'] = (type, data) =>
    sendEvent({
      type,
      timestamp: new Date(),
      data,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
    });

  const sendBillingEvent: SlackMonitoringServiceInterface['sendBillingEvent'] = (type, data) =>
    sendEvent({
      type,
      timestamp: new Date(),
      data,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
    });

  const sendVideoEvent: SlackMonitoringServiceInterface['sendVideoEvent'] = (type, data) =>
    sendEvent({
      type,
      timestamp: new Date(),
      data,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      userId: data.userId,
      userName: data.userName,
    });

  const sendErrorEvent: SlackMonitoringServiceInterface['sendErrorEvent'] = (type, data) => {
    // Get the webhook URL for errors
    const webhookUrl = getWebhookUrl('errors');

    // Skip if no webhook configured
    if (!webhookUrl) {
      return Effect.succeed(undefined);
    }

    // Use enhanced error payload builder
    const payload = buildErrorEventPayload(type, data, new Date());

    return sendWebhook(payload, webhookUrl);
  };

  return {
    isConfigured,
    sendEvent,
    sendAccountEvent,
    sendBillingEvent,
    sendVideoEvent,
    sendErrorEvent,
  } satisfies SlackMonitoringServiceInterface;
});

// =============================================================================
// Slack Monitoring Layer
// =============================================================================

export const SlackMonitoringLive = Layer.effect(SlackMonitoring, makeSlackMonitoringService);

// =============================================================================
// Helper Functions
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
// Standalone Functions (for use outside Effect contexts, e.g., better-auth hooks)
// =============================================================================

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
        console.error(`[SlackMonitoring] Webhook failed: ${response.status}`);
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
      console.error(`[SlackMonitoring] Webhook failed: ${response.status}`);
    }
  } catch (error) {
    // Log but don't throw - monitoring should never break the app
    console.error('[SlackMonitoring] Failed to send notification:', error);
  }
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
