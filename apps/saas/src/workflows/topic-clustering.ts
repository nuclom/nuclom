/**
 * Topic Clustering Workflow using Workflow DevKit
 *
 * Automatically clusters content items into topics using semantic similarity.
 * Runs daily to organize new content and re-evaluate existing clusters.
 *
 * Uses the TopicCluster service's autoCluster method which:
 * - Groups related content by embedding similarity
 * - Uses AI to generate topic names and descriptions
 * - Assigns content to appropriate clusters
 */

import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('topic-clustering-workflow');

// =============================================================================
// Types
// =============================================================================

export interface TopicClusteringResult {
  organizationsProcessed: number;
  totalClusters: number;
  totalItemsClustered: number;
  timestamp: Date;
}

// =============================================================================
// Helper Steps
// =============================================================================

async function getActiveOrganizations(): Promise<string[]> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { organizations } = await import('@nuclom/lib/db/schema');

  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(100);

  return orgs.map((o) => o.id);
}

async function clusterOrganization(
  organizationId: string,
): Promise<{ clusterCount: number; itemCount: number } | null> {
  'use step';

  const { Effect } = await import('effect');
  const { AppLive } = await import('@nuclom/lib/effect/runtime');
  const { TopicCluster } = await import('@nuclom/lib/effect/services/knowledge/topic-cluster');

  const effect = Effect.gen(function* () {
    const topicClusterService = yield* TopicCluster;

    // Run auto-clustering for this organization
    const result = yield* topicClusterService.autoCluster({
      organizationId,
      minClusterSize: 3,
      maxClusters: 50,
      similarityThreshold: 0.7,
      useAI: true,
    });

    return {
      clusterCount: result.clusters.length,
      itemCount: result.clusters.reduce((acc, c) => acc + c.memberIds.length, 0),
    };
  });

  try {
    const runnable = Effect.provide(effect, AppLive);
    return await Effect.runPromise(runnable);
  } catch (error) {
    log.error({ organizationId, error }, 'Failed to cluster organization');
    return null;
  }
}

// =============================================================================
// Workflow
// =============================================================================

/**
 * Run topic clustering for all organizations.
 *
 * This workflow executes once per cron invocation.
 * Cron handles the daily scheduling at 2 AM.
 */
export async function topicClusteringWorkflow(): Promise<TopicClusteringResult> {
  'use workflow';

  log.info({}, 'Starting topic clustering workflow');

  // Get all active organizations
  const organizationIds = await getActiveOrganizations();
  log.info({ organizationCount: organizationIds.length }, 'Found organizations to process');

  let totalClusters = 0;
  let totalItemsClustered = 0;
  let organizationsProcessed = 0;

  // Process each organization
  for (const organizationId of organizationIds) {
    const result = await clusterOrganization(organizationId);

    if (result) {
      totalClusters += result.clusterCount;
      totalItemsClustered += result.itemCount;
      organizationsProcessed++;
    }
  }

  log.info(
    {
      organizationsProcessed,
      totalClusters,
      totalItemsClustered,
      timestamp: new Date().toISOString(),
    },
    'Topic clustering completed',
  );

  return {
    organizationsProcessed,
    totalClusters,
    totalItemsClustered,
    timestamp: new Date(),
  };
}
