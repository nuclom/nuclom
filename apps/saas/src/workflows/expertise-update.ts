/**
 * Expertise Update Workflow using Workflow DevKit
 *
 * Updates expertise scores for all topic clusters based on recent contributions.
 * Runs weekly to recalculate who the experts are for each topic.
 *
 * Uses the TopicCluster service's updateExpertiseScores method which:
 * - Calculates contribution counts per user/contributor
 * - Updates expertise scores based on recent activity
 * - Considers content quality and engagement
 */

import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('expertise-update-workflow');

// =============================================================================
// Types
// =============================================================================

export interface ExpertiseUpdateResult {
  clustersProcessed: number;
  timestamp: Date;
}

// =============================================================================
// Helper Steps
// =============================================================================

async function getAllClusters(): Promise<Array<{ id: string; organizationId: string }>> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { topicClusters } = await import('@nuclom/lib/db/schema');

  const clusters = await db
    .select({
      id: topicClusters.id,
      organizationId: topicClusters.organizationId,
    })
    .from(topicClusters)
    .limit(1000);

  return clusters;
}

async function updateClusterExpertise(clusterId: string): Promise<boolean> {
  'use step';

  const { Effect } = await import('effect');
  const { AppLive } = await import('@nuclom/lib/effect/runtime');
  const { TopicCluster } = await import('@nuclom/lib/effect/services/knowledge/topic-cluster');

  const effect = Effect.gen(function* () {
    const topicClusterService = yield* TopicCluster;
    yield* topicClusterService.updateExpertiseScores(clusterId);
    return true;
  });

  try {
    const runnable = Effect.provide(effect, AppLive);
    await Effect.runPromise(runnable);
    return true;
  } catch (error) {
    log.error({ clusterId, error }, 'Failed to update expertise for cluster');
    return false;
  }
}

// =============================================================================
// Workflow
// =============================================================================

/**
 * Update expertise scores for all topic clusters.
 *
 * This workflow executes once per cron invocation.
 * Cron handles the weekly scheduling (Sunday at 3 AM).
 */
export async function expertiseUpdateWorkflow(): Promise<ExpertiseUpdateResult> {
  'use workflow';

  log.info({}, 'Starting expertise update workflow');

  // Get all clusters
  const clusters = await getAllClusters();
  log.info({ clusterCount: clusters.length }, 'Found clusters to process');

  let clustersProcessed = 0;

  // Update expertise for each cluster
  for (const cluster of clusters) {
    const success = await updateClusterExpertise(cluster.id);
    if (success) {
      clustersProcessed++;
    }
  }

  log.info(
    {
      clustersProcessed,
      totalClusters: clusters.length,
      timestamp: new Date().toISOString(),
    },
    'Expertise update completed',
  );

  return {
    clustersProcessed,
    timestamp: new Date(),
  };
}
