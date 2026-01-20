/**
 * Knowledge Graph Services
 *
 * Services for building and maintaining a cross-source knowledge graph:
 * - RelationshipDetector: Detects relationships between content items
 * - DecisionTracker: Tracks decisions from content across sources
 * - TopicCluster: Groups content by topic and tracks expertise
 * - KnowledgeQA: RAG-based question answering over the knowledge base
 * - KnowledgeGapDetector: Finds gaps and conflicts in documentation
 * - SmartSummary: Generates intelligent summaries and digests
 * - ProactiveInsight: Generates insights and recommendations
 */

// Decision Tracker
export type {
  CreateDecisionInput,
  DecisionFilters,
  DecisionStatus,
  DecisionTimelineEntry,
  DecisionTrackerService,
  DecisionType,
  DecisionWithRelations,
  ExtractedDecision,
  UpdateDecisionInput,
} from './decision-tracker';
export {
  createDecision,
  DecisionTracker,
  DecisionTrackerLive,
  extractDecisions,
  getDecision,
  listDecisions,
  updateDecisionStatus,
} from './decision-tracker';
// Knowledge Gap Detector
export type {
  ConflictType,
  DecisionConflict,
  GapSeverity,
  GapType,
  KnowledgeGapDetectorServiceInterface,
  TopicCoverageGap,
  UndocumentedDecision,
} from './knowledge-gap-detector';
export {
  analyzeTopicCoverage,
  detectConflicts,
  findUndocumentedDecisions,
  KnowledgeGapDetector,
  KnowledgeGapDetectorLive,
} from './knowledge-gap-detector';
// Knowledge Q&A
export type {
  ChatMessage as KnowledgeChatMessage,
  ChatResponse as KnowledgeChatResponse,
  KnowledgeQAServiceInterface,
  QuestionAnswerResult,
  QuestionSource,
} from './knowledge-qa';
export { answerQuestion, chatWithKnowledge, KnowledgeQA, KnowledgeQALive } from './knowledge-qa';
// Proactive Insight
export type {
  ImpactLevel,
  InsightType,
  ProactiveInsightItem as ProactiveInsightResult,
  ProactiveInsightServiceInterface,
  Recommendation,
  TrendAnalysis,
} from './proactive-insight';
export {
  analyzeTrends,
  generateInsights,
  getRecommendations,
  ProactiveInsight,
  ProactiveInsightLive,
} from './proactive-insight';
// Relationship Detector
export type {
  DetectionOptions,
  DetectionResult,
  RelationshipCandidate,
  RelationshipDetectorService,
} from './relationship-detector';
export {
  detectRelationships,
  detectRelationshipsForItem,
  findSimilarContentItems,
  RelationshipDetector,
  RelationshipDetectorLive,
} from './relationship-detector';

// Smart Summary
export type {
  DailyDigest,
  MeetingPrepMaterial,
  SmartSummaryServiceInterface,
  SourceBreakdown,
  SummaryDepth,
  TopicSummary,
} from './smart-summary';
export {
  generateDailyDigest,
  generateMeetingPrep,
  generateTopicSummary,
  SmartSummary,
  SmartSummaryLive,
} from './smart-summary';
// Topic Cluster
export type {
  ClusteringOptions,
  ClusteringResult,
  CreateTopicClusterInput,
  TopicClusterService,
  TopicClusterWithMembers,
  TopicExpertiseEntry,
} from './topic-cluster';
export {
  autoClusterContent,
  createTopicCluster,
  getTopicCluster,
  getTopicExperts,
  TopicCluster,
  TopicClusterLive,
} from './topic-cluster';
