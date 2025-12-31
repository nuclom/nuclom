/**
 * Workflows using Workflow DevKit
 *
 * This module exports all durable workflows for the application.
 * Each workflow uses the Workflow DevKit for:
 * - Automatic retries on transient failures
 * - Resume from last successful step on server restart
 * - Built-in observability and debugging
 * - Resource-efficient sleep for scheduled operations
 */

// Video Processing
export { processVideoWorkflow, type VideoProcessingInput, type VideoProcessingResult } from "./video-processing";

// Meeting Import
export { importMeetingWorkflow, type ImportMeetingInput, type ImportMeetingResult } from "./import-meeting";

// Scheduled Cleanup
export { scheduledCleanupWorkflow, runCleanupOnce, type CleanupResult } from "./scheduled-cleanup";

// Trial Reminders
export { trialReminderWorkflow, type TrialReminderInput, type TrialReminderResult } from "./trial-reminders";

// Stripe Webhook Handlers
export {
  handleSubscriptionCreatedWorkflow,
  handleSubscriptionUpdatedWorkflow,
  handleSubscriptionDeletedWorkflow,
  handleInvoicePaidWorkflow,
  handleInvoiceFailedWorkflow,
  handleTrialEndingWorkflow,
  type StripeWebhookInput,
  type StripeWebhookResult,
} from "./stripe-webhooks";
