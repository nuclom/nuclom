/**
 * Slack Monitoring Service
 *
 * This module provides Slack notifications for platform events.
 * Re-exports all public types and functions.
 */

// Formatters
export {
  buildErrorEventPayload,
  buildEventBlocks,
  formatCurrency,
  formatDuration,
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
// Helper functions
export {
  notifySlackMonitoring,
  sendSlackAccountEvent,
  sendSlackBillingEvent,
  sendSlackErrorEvent,
  sendSlackMonitoringEvent,
  sendSlackVideoEvent,
} from './helpers';

// Service
export { SlackMonitoring, SlackMonitoringLive } from './service';
// Types
export type {
  ErrorSeverity,
  EventCategory,
  MonitoringEvent,
  MonitoringEventType,
  SlackMonitoringServiceInterface,
  SlackWebhookPayload,
} from './types';
