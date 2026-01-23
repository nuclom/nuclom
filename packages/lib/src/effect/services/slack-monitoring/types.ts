/**
 * Slack Monitoring Types
 *
 * Type definitions for Slack monitoring events and payloads.
 */

import type { KnownBlock, MessageAttachment } from '@slack/web-api';
import type { Effect } from 'effect';

// =============================================================================
// Monitoring Event Types
// =============================================================================

export type MonitoringEventType =
  // Account events
  | 'user_registered'
  | 'organization_created'
  | 'member_invited'
  | 'member_joined'
  | 'invitation_accepted'
  | 'beta_access_requested'
  | 'contact_inquiry'
  | 'support_request'
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

export interface SlackWebhookPayload {
  readonly text: string;
  readonly blocks?: KnownBlock[];
  readonly attachments?: MessageAttachment[];
  readonly unfurl_links?: boolean;
  readonly unfurl_media?: boolean;
}

// =============================================================================
// Event Categories and Severity
// =============================================================================

export type EventCategory = 'accounts' | 'billing' | 'usage' | 'errors';

export type ErrorSeverity = 'critical' | 'error' | 'warning';

// =============================================================================
// Service Interface
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
      | 'beta_access_requested'
      | 'contact_inquiry'
      | 'support_request',
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
      subject?: string;
      message?: string;
      phone?: string;
      jobTitle?: string;
      teamSize?: string;
      industry?: string;
      timeline?: string;
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
