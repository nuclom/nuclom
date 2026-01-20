/**
 * Knowledge Graph Services
 *
 * Services for building and maintaining a cross-source knowledge graph:
 * - RelationshipDetector: Detects relationships between content items
 * - DecisionTracker: Tracks decisions from content across sources
 * - TopicCluster: Groups content by topic and tracks expertise
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
