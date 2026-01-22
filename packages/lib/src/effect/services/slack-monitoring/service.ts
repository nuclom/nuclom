/**
 * Slack Monitoring Service
 *
 * Effect-TS service for sending platform event notifications to Slack.
 */

import { Config, Context, Effect, Layer, Option } from 'effect';
import { getAppUrl } from '../../../env/server';
import { SlackWebhookClient } from '../slack-client';
import { buildErrorEventPayload, buildEventBlocks, getEventCategory, getEventEmoji, getEventTitle } from './formatters';
import type { EventCategory, MonitoringEvent, SlackMonitoringServiceInterface, SlackWebhookPayload } from './types';

// =============================================================================
// Slack Monitoring Service Tag
// =============================================================================

export class SlackMonitoring extends Context.Tag('SlackMonitoring')<
  SlackMonitoring,
  SlackMonitoringServiceInterface
>() {}

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
// Service Implementation
// =============================================================================

const makeSlackMonitoringService = Effect.gen(function* () {
  const config = yield* SlackMonitoringConfigEffect;
  const slackWebhookClient = yield* SlackWebhookClient;

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
    Effect.gen(function* () {
      const webhook = yield* slackWebhookClient.create(webhookUrl);
      return yield* Effect.tryPromise({
        try: () => webhook.send(payload),
        catch: (error) =>
          new Error(`Failed to send Slack notification: ${error instanceof Error ? error.message : 'Unknown error'}`),
      });
    });

  const sendEvent = (event: MonitoringEvent): Effect.Effect<void, Error> => {
    // Get the webhook URL for this event category
    const category = getEventCategory(event.type);
    const webhookUrl = getWebhookUrl(category);

    // Skip if no webhook configured for this category
    if (!webhookUrl) {
      return Effect.succeed(undefined);
    }

    const blocks = buildEventBlocks(event, appUrl);
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
    const payload = buildErrorEventPayload(type, data, new Date(), appUrl);

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
// Layer
// =============================================================================

export const SlackMonitoringLive = Layer.effect(SlackMonitoring, makeSlackMonitoringService);
