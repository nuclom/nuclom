/**
 * Database Enums
 *
 * All PostgreSQL enum types used across the schema.
 * Centralized here to avoid circular dependencies between schema files.
 *
 * Enums by domain:
 * - Auth: userRoleEnum, organizationRoleEnum
 * - Videos: processingStatusEnum
 * - Comments: reactionTypeEnum
 * - Notifications: notificationTypeEnum
 * - Integrations: integrationProviderEnum, importStatusEnum
 * - Billing: subscriptionStatusEnum, invoiceStatusEnum
 * - Knowledge Graph: decisionStatusEnum, participantRoleEnum, knowledgeNodeTypeEnum, decisionTypeEnum
 * - AI Insights: topicTrendEnum, actionItemStatusEnum, actionItemPriorityEnum
 * - Legal: legalDocumentTypeEnum, consentActionEnum, reportCategoryEnum, reportStatusEnum, reportResolutionEnum, reportResourceTypeEnum
 * - Audit Logs: auditLogCategoryEnum, auditLogSeverityEnum
 * - Analytics: videoViewSourceEnum
 * - Sharing: videoShareLinkStatusEnum, videoShareLinkAccessEnum
 * - Visibility: videoVisibilityEnum
 * - Workflows: workflowTemplateTypeEnum
 * - Clips: clipTypeEnum, momentTypeEnum, clipStatusEnum, highlightReelStatusEnum
 * - Health: healthCheckServiceEnum, healthCheckStatusEnum
 * - Activity: activityTypeEnum, zapierWebhookEventEnum
 * - Vocabulary: vocabularyCategoryEnum, correctionSuggestionStatusEnum
 */

import { pgEnum } from 'drizzle-orm/pg-core';

// =============================================================================
// Auth & User Enums
// =============================================================================

export const userRoleEnum = pgEnum('UserRole', ['user', 'admin']);
export const organizationRoleEnum = pgEnum('OrganizationRole', ['owner', 'member']);

// =============================================================================
// Collection Enums
// =============================================================================

export const collectionTypeEnum = pgEnum('CollectionType', ['folder', 'playlist']);

// =============================================================================
// Video Processing Enums
// =============================================================================

export const processingStatusEnum = pgEnum('ProcessingStatus', [
  'pending',
  'transcribing',
  'diarizing',
  'analyzing',
  'completed',
  'failed',
]);

// =============================================================================
// Comment & Reaction Enums
// =============================================================================

export const reactionTypeEnum = pgEnum('ReactionType', [
  'like',
  'love',
  'laugh',
  'surprised',
  'sad',
  'angry',
  'thinking',
  'celebrate',
]);

// =============================================================================
// Notification Enums
// =============================================================================

export const notificationTypeEnum = pgEnum('NotificationType', [
  'comment_reply',
  'comment_mention',
  'new_comment_on_video',
  'video_shared',
  'video_processing_complete',
  'video_processing_failed',
  'invitation_received',
  'trial_ending',
  'subscription_created',
  'subscription_updated',
  'subscription_canceled',
  'payment_failed',
  'payment_succeeded',
  // Organization management notifications
  'organization_created',
  'member_added',
  'member_removed',
  'role_updated',
  // Billing usage alerts
  'usage_alert',
]);

// =============================================================================
// Integration Enums
// =============================================================================

export const integrationProviderEnum = pgEnum('IntegrationProvider', [
  'zoom',
  'google_meet',
  'slack',
  'microsoft_teams',
  'github',
]);

export const importStatusEnum = pgEnum('ImportStatus', ['pending', 'downloading', 'processing', 'completed', 'failed']);

// =============================================================================
// Billing Enums
// =============================================================================

export const subscriptionStatusEnum = pgEnum('SubscriptionStatus', [
  'active',
  'canceled',
  'past_due',
  'trialing',
  'incomplete',
  'incomplete_expired',
  'unpaid',
]);

export const invoiceStatusEnum = pgEnum('InvoiceStatus', ['draft', 'open', 'paid', 'void', 'uncollectible']);

// =============================================================================
// Knowledge Graph Enums
// =============================================================================

export const decisionStatusEnum = pgEnum('DecisionStatus', [
  'proposed',
  'decided',
  'implemented',
  'revisited',
  'superseded',
]);
export const participantRoleEnum = pgEnum('ParticipantRole', [
  'proposer',
  'decider',
  'approver',
  'objector',
  'participant',
  'mentioned',
]);
export const knowledgeNodeTypeEnum = pgEnum('KnowledgeNodeType', ['person', 'topic', 'artifact', 'decision', 'video']);
export const decisionTypeEnum = pgEnum('DecisionType', [
  'technical',
  'process',
  'product',
  'team',
  'resource',
  'other',
]);

// =============================================================================
// AI Insights Enums
// =============================================================================

export const topicTrendEnum = pgEnum('TopicTrend', ['rising', 'stable', 'declining']);
export const actionItemStatusEnum = pgEnum('ActionItemStatus', ['pending', 'in_progress', 'completed', 'cancelled']);
export const actionItemPriorityEnum = pgEnum('ActionItemPriority', ['high', 'medium', 'low']);

// =============================================================================
// Legal & Compliance Enums
// =============================================================================

export const legalDocumentTypeEnum = pgEnum('LegalDocumentType', ['terms_of_service', 'privacy_policy']);
export const consentActionEnum = pgEnum('ConsentAction', ['granted', 'withdrawn', 'updated']);
export const reportCategoryEnum = pgEnum('ReportCategory', [
  'inappropriate',
  'spam',
  'copyright',
  'harassment',
  'other',
]);
export const reportStatusEnum = pgEnum('ReportStatus', ['pending', 'reviewing', 'resolved', 'dismissed']);
export const reportResolutionEnum = pgEnum('ReportResolution', [
  'content_removed',
  'user_warned',
  'user_suspended',
  'no_action',
]);
export const reportResourceTypeEnum = pgEnum('ReportResourceType', ['video', 'comment', 'user']);

// =============================================================================
// Audit Log Enums
// =============================================================================

export const auditLogCategoryEnum = pgEnum('AuditLogCategory', [
  'authentication',
  'authorization',
  'user_management',
  'organization_management',
  'content_management',
  'billing',
  'security',
  'integration',
  'system',
]);
export const auditLogSeverityEnum = pgEnum('AuditLogSeverity', ['info', 'warning', 'error', 'critical']);

// =============================================================================
// Video Analytics Enums
// =============================================================================

export const videoViewSourceEnum = pgEnum('VideoViewSource', ['direct', 'share_link', 'embed']);

// =============================================================================
// Video Sharing Enums
// =============================================================================

export const videoShareLinkStatusEnum = pgEnum('VideoShareLinkStatus', ['active', 'expired', 'revoked']);
export const videoShareLinkAccessEnum = pgEnum('VideoShareLinkAccess', ['view', 'comment', 'download']);

// =============================================================================
// Video Visibility Enums
// =============================================================================

/**
 * Video visibility levels:
 * - private: Only visible to the owner, can be shared with specific users/teams
 * - organization: Visible to all members of the organization (default)
 * - public: Publicly accessible from the internet without authentication
 */
export const videoVisibilityEnum = pgEnum('VideoVisibility', ['private', 'organization', 'public']);

// =============================================================================
// Workflow Template Enums
// =============================================================================

export const workflowTemplateTypeEnum = pgEnum('WorkflowTemplateType', [
  'onboarding',
  'tutorial',
  'meeting_recap',
  'product_demo',
  'training',
  'marketing',
  'custom',
]);

// =============================================================================
// Video Clips Enums
// =============================================================================

export const clipTypeEnum = pgEnum('ClipType', ['auto', 'manual']);
export const momentTypeEnum = pgEnum('MomentType', [
  'decision',
  'action_item',
  'question',
  'answer',
  'emphasis',
  'demonstration',
  'conclusion',
  'highlight',
]);
export const clipStatusEnum = pgEnum('ClipStatus', ['pending', 'processing', 'ready', 'failed']);
export const highlightReelStatusEnum = pgEnum('HighlightReelStatus', ['draft', 'rendering', 'ready', 'failed']);

// =============================================================================
// Health Check Enums
// =============================================================================

export const healthCheckServiceEnum = pgEnum('HealthCheckService', ['database', 'storage', 'ai', 'overall']);
export const healthCheckStatusEnum = pgEnum('HealthCheckStatus', [
  'healthy',
  'degraded',
  'unhealthy',
  'not_configured',
]);

// =============================================================================
// Activity Feed Enums
// =============================================================================

export const activityTypeEnum = pgEnum('ActivityType', [
  'video_uploaded',
  'video_processed',
  'video_shared',
  'comment_added',
  'comment_reply',
  'reaction_added',
  'member_joined',
  'member_left',
  'integration_connected',
  'integration_disconnected',
  'video_imported',
]);

// =============================================================================
// Zapier Webhook Enums
// =============================================================================

export const zapierWebhookEventEnum = pgEnum('ZapierWebhookEvent', [
  'video.uploaded',
  'video.processed',
  'video.shared',
  'comment.created',
  'comment.replied',
  'member.joined',
  'member.left',
]);

// =============================================================================
// Vocabulary Enums
// =============================================================================

export const vocabularyCategoryEnum = pgEnum('VocabularyCategory', [
  'product',
  'person',
  'technical',
  'acronym',
  'company',
]);

export const correctionSuggestionStatusEnum = pgEnum('CorrectionSuggestionStatus', [
  'pending',
  'accepted',
  'dismissed',
]);

// =============================================================================
// Chat Enums
// =============================================================================

export const chatMessageRoleEnum = pgEnum('ChatMessageRole', ['user', 'assistant', 'system', 'tool']);

// =============================================================================
// Content Source Enums
// =============================================================================

/**
 * Types of content sources that can be connected to an organization.
 * - video: Native video recordings (internal source)
 * - slack: Slack workspace integration
 * - notion: Notion workspace integration
 * - github: GitHub repository integration
 * - google_drive: Google Drive integration
 * - confluence: Confluence wiki integration
 * - linear: Linear project management integration
 */
export const contentSourceTypeEnum = pgEnum('ContentSourceType', [
  'video',
  'slack',
  'notion',
  'github',
  'google_drive',
  'confluence',
  'linear',
]);

/**
 * Sync status for content sources.
 */
export const contentSourceSyncStatusEnum = pgEnum('ContentSourceSyncStatus', ['idle', 'syncing', 'error', 'disabled']);

/**
 * Types of content items from various sources.
 * - video: Video recording
 * - message: Chat message (Slack, Teams, etc.)
 * - thread: Conversation thread
 * - document: Document or page (Notion, Confluence, etc.)
 * - issue: Issue or ticket (GitHub, Linear, etc.)
 * - pull_request: Code review / PR
 * - comment: Comment on any content
 * - file: File attachment
 */
export const contentItemTypeEnum = pgEnum('ContentItemType', [
  'video',
  'message',
  'thread',
  'document',
  'issue',
  'pull_request',
  'comment',
  'file',
]);

/**
 * Processing status for content items.
 */
export const contentProcessingStatusEnum = pgEnum('ContentProcessingStatus', [
  'pending',
  'processing',
  'completed',
  'failed',
  'skipped',
]);

/**
 * Types of relationships between content items.
 * - references: One item references another
 * - replies_to: Reply/response relationship
 * - implements: Implementation of a decision/issue
 * - supersedes: Replaces a previous item
 * - relates_to: Generic relationship
 * - mentions: Mentions another item
 * - derived_from: Derived/summarized from another item
 */
export const contentRelationshipTypeEnum = pgEnum('ContentRelationshipType', [
  'references',
  'replies_to',
  'implements',
  'supersedes',
  'relates_to',
  'similar_to',
  'mentions',
  'derived_from',
]);

/**
 * Roles for content participants.
 */
export const contentParticipantRoleEnum = pgEnum('ContentParticipantRole', [
  'author',
  'speaker',
  'participant',
  'mentioned',
  'assignee',
  'reviewer',
]);
