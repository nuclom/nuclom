/**
 * Knowledge Graph Services
 *
 * Services for building and maintaining a cross-source knowledge graph:
 * - RelationshipDetector: Detects relationships between content items
 * - DecisionTracker: Tracks decisions from content across sources
 * - TopicCluster: Groups content by topic and tracks expertise
 */

// Relationship Detector
export type { RelationshipDetectorService, RelationshipCandidate, DetectionOptions, DetectionResult } from './relationship-detector';
export {
  RelationshipDetector,
  RelationshipDetectorLive,
  detectRelationshipsForItem,
  detectRelationships,
  findSimilarContentItems,
} from './relationship-detector';

// Decision Tracker
export type {
  DecisionTrackerService,
  CreateDecisionInput,
  UpdateDecisionInput,
  DecisionFilters,
  DecisionWithRelations,
  DecisionTimelineEntry,
  ExtractedDecision,
  DecisionStatus,
  DecisionType,
} from './decision-tracker';
export {
  DecisionTracker,
  DecisionTrackerLive,
  createDecision,
  getDecision,
  listDecisions,
  updateDecisionStatus,
  extractDecisions,
} from './decision-tracker';

// Topic Cluster
export type {
  TopicClusterService,
  CreateTopicClusterInput,
  TopicClusterWithMembers,
  TopicExpertiseEntry,
  ClusteringOptions,
  ClusteringResult,
} from './topic-cluster';
export {
  TopicCluster,
  TopicClusterLive,
  createTopicCluster,
  getTopicCluster,
  autoClusterContent,
  getTopicExperts,
} from './topic-cluster';
