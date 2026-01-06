/**
 * Slack Monitoring Service using Effect-TS
 *
 * Provides platform event monitoring via Slack webhooks.
 * Sends notifications for account creation, billing events, platform usage, and errors.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { env, getAppUrl } from '@/lib/env/server';

// =============================================================================
// Types
// =============================================================================

export type MonitoringEventType =
  // Account events
  | 'user_registered'
  | 'organization_created'
  | 'member_invited'
  | 'member_joined'
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

interface SlackWebhookPayload {
  readonly text: string;
  readonly blocks?: SlackBlock[];
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
    type: 'user_registered' | 'organization_created' | 'member_invited' | 'member_joined' | 'beta_access_requested',
    data: {
      userId?: string;
      userName?: string;
      userEmail?: string;
      organizationId?: string;
      organizationName?: string;
      inviterName?: string;
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
      stackTrace?: string;
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

  const sendErrorEvent: SlackMonitoringServiceInterface['sendErrorEvent'] = (type, data) =>
    sendEvent({
      type,
      timestamp: new Date(),
      data,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      userId: data.userId,
    });

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
  type: 'user_registered' | 'organization_created' | 'member_invited' | 'member_joined' | 'beta_access_requested',
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
