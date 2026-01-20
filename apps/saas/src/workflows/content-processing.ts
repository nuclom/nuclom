/**
 * Content Processing Workflow
 *
 * Handles processing of ingested content items from external sources:
 * 1. Generate embeddings for semantic search
 * 2. Extract key points and summary using AI
 * 3. Detect relationships with existing content
 * 4. Assign to topic clusters
 * 5. Update search index
 *
 * This workflow is triggered after content is ingested from Slack, Notion, GitHub, etc.
 */

import { FatalError } from 'workflow';
import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('content-processing');

// =============================================================================
// Types
// =============================================================================

export interface ContentProcessingInput {
  readonly contentItemId: string;
  readonly organizationId: string;
  readonly sourceType: 'slack' | 'notion' | 'github' | 'google_drive' | 'confluence' | 'linear';
  readonly skipRelationshipDetection?: boolean;
  readonly skipTopicClustering?: boolean;
}

export interface ContentProcessingResult {
  readonly contentItemId: string;
  readonly success: boolean;
  readonly error?: string;
  readonly embeddingGenerated: boolean;
  readonly relationshipsDetected: number;
  readonly topicClusterAssigned?: string;
}

interface ProcessedContent {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
}

interface RelationshipResult {
  relatedItems: Array<{
    contentItemId: string;
    similarity: number;
    relationshipType: string;
  }>;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getContentItem(contentItemId: string) {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { contentItems, contentSources } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const result = await db
    .select({
      item: contentItems,
      source: contentSources,
    })
    .from(contentItems)
    .leftJoin(contentSources, eq(contentItems.sourceId, contentSources.id))
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (result.length === 0) {
    throw new FatalError(`Content item not found: ${contentItemId}`);
  }

  return {
    ...result[0].item,
    source: result[0].source,
  };
}

async function generateEmbedding(text: string): Promise<number[]> {
  'use step';

  const { gateway } = await import('@ai-sdk/gateway');
  const { embed } = await import('ai');

  const model = gateway.textEmbeddingModel('text-embedding-3-small');

  const { embedding } = await embed({
    model,
    value: text,
  });

  return embedding;
}

async function processContentWithAI(
  title: string | null,
  content: string | null,
  sourceType: string,
): Promise<ProcessedContent> {
  'use step';

  if (!content && !title) {
    return {
      summary: '',
      keyPoints: [],
      sentiment: 'neutral',
      topics: [],
    };
  }

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateObject, jsonSchema } = await import('ai');

  const model = gateway('openai/gpt-4o-mini');

  const contentSchema = jsonSchema<ProcessedContent>({
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'A 1-2 sentence summary of the content' },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points or takeaways from the content (max 5)',
      },
      sentiment: {
        type: 'string',
        enum: ['positive', 'negative', 'neutral', 'mixed'],
        description: 'Overall sentiment of the content',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Main topics discussed (max 5)',
      },
    },
    required: ['summary', 'keyPoints', 'sentiment', 'topics'],
  });

  const prompt = `Analyze this ${sourceType} content and extract key information.

Title: ${title || 'N/A'}

Content:
${content?.slice(0, 4000) || 'N/A'}

Provide a concise summary, key points, sentiment analysis, and main topics.`;

  try {
    const result = await generateObject({
      model,
      schema: contentSchema,
      prompt,
    });

    return result.object;
  } catch (error) {
    log.warn({ error }, 'AI content processing failed, using fallback');
    return {
      summary: title || content?.slice(0, 200) || '',
      keyPoints: [],
      sentiment: 'neutral',
      topics: [],
    };
  }
}

async function updateContentItemWithEmbedding(
  contentItemId: string,
  embedding: number[],
  processedContent: ProcessedContent,
): Promise<void> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { contentItems } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  await db
    .update(contentItems)
    .set({
      embeddingVector: embedding,
      summary: processedContent.summary,
      keyPoints: processedContent.keyPoints.map((text) => ({ text })),
      sentiment: processedContent.sentiment,
      processingStatus: 'completed',
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, contentItemId));

  log.info({ contentItemId }, 'Updated content item with embedding and AI analysis');
}

async function detectRelationships(
  contentItemId: string,
  organizationId: string,
  embedding: number[],
): Promise<RelationshipResult> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { contentRelationships } = await import('@nuclom/lib/db/schema');
  const { sql } = await import('drizzle-orm');

  const embeddingStr = `[${embedding.join(',')}]`;
  const similarityThreshold = 0.7;

  // Find semantically similar content items
  const similarItems = await db.execute<{
    id: string;
    title: string | null;
    type: string;
    similarity: number;
  }>(sql`
    SELECT
      id,
      title,
      type,
      1 - (embedding_vector <=> ${embeddingStr}::vector) as similarity
    FROM content_items
    WHERE organization_id = ${organizationId}
      AND id != ${contentItemId}
      AND embedding_vector IS NOT NULL
      AND 1 - (embedding_vector <=> ${embeddingStr}::vector) >= ${similarityThreshold}
    ORDER BY similarity DESC
    LIMIT 10
  `);

  // Create relationship records for highly similar items
  const relatedItems: RelationshipResult['relatedItems'] = [];

  for (const item of similarItems) {
    // Determine relationship type based on similarity
    // Using 'similar_to' for semantic similarity matches
    const relationshipType = item.similarity >= 0.9 ? 'relates_to' : 'similar_to';

    relatedItems.push({
      contentItemId: item.id,
      similarity: item.similarity,
      relationshipType,
    });

    // Store the relationship
    try {
      await db
        .insert(contentRelationships)
        .values({
          sourceItemId: contentItemId,
          targetItemId: item.id,
          relationshipType,
          confidence: item.similarity,
        })
        .onConflictDoNothing();
    } catch (error) {
      log.warn({ error, contentItemId, relatedId: item.id }, 'Failed to create relationship');
    }
  }

  log.info({ contentItemId, relatedCount: relatedItems.length }, 'Detected relationships');

  return { relatedItems };
}

async function assignToTopicCluster(
  contentItemId: string,
  organizationId: string,
  embedding: number[],
): Promise<string | null> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { topicClusterMembers } = await import('@nuclom/lib/db/schema');
  const { sql } = await import('drizzle-orm');

  const embeddingStr = `[${embedding.join(',')}]`;
  const minSimilarity = 0.65;

  // Find the best matching topic cluster
  const matchingClusters = await db.execute<{
    id: string;
    name: string;
    similarity: number;
  }>(sql`
    SELECT
      id,
      name,
      1 - (embedding_centroid <=> ${embeddingStr}::vector) as similarity
    FROM topic_clusters
    WHERE organization_id = ${organizationId}
      AND embedding_centroid IS NOT NULL
      AND 1 - (embedding_centroid <=> ${embeddingStr}::vector) >= ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT 1
  `);

  if (matchingClusters.length === 0) {
    log.info({ contentItemId }, 'No matching topic cluster found');
    return null;
  }

  const bestCluster = matchingClusters[0];

  // Add content item to the cluster
  try {
    await db
      .insert(topicClusterMembers)
      .values({
        clusterId: bestCluster.id,
        contentItemId,
        similarityScore: bestCluster.similarity,
        addedAt: new Date(),
      })
      .onConflictDoNothing();

    log.info({ contentItemId, clusterId: bestCluster.id, clusterName: bestCluster.name }, 'Assigned to topic cluster');

    return bestCluster.id;
  } catch (error) {
    log.warn({ error, contentItemId }, 'Failed to assign to topic cluster');
    return null;
  }
}

async function updateSearchIndex(contentItemId: string, searchText: string): Promise<void> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { contentItems } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  // Update search text for full-text search
  await db
    .update(contentItems)
    .set({
      searchText: searchText.slice(0, 50000), // Limit search text size
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, contentItemId));

  log.info({ contentItemId }, 'Updated search index');
}

async function markProcessingFailed(contentItemId: string, error: string): Promise<void> {
  'use step';

  const { db } = await import('@nuclom/lib/db');
  const { contentItems } = await import('@nuclom/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  await db
    .update(contentItems)
    .set({
      processingStatus: 'failed',
      processingError: error,
      updatedAt: new Date(),
    })
    .where(eq(contentItems.id, contentItemId));
}

// =============================================================================
// Main Workflow
// =============================================================================

export async function processContentWorkflow(input: ContentProcessingInput): Promise<ContentProcessingResult> {
  'use workflow';

  const { contentItemId, organizationId, sourceType, skipRelationshipDetection, skipTopicClustering } = input;

  log.info({ contentItemId, sourceType }, 'Starting content processing workflow');

  try {
    // Step 1: Get content item
    const contentItem = await getContentItem(contentItemId);

    if (contentItem.processingStatus === 'completed') {
      log.info({ contentItemId }, 'Content item already processed, skipping');
      return {
        contentItemId,
        success: true,
        embeddingGenerated: false,
        relationshipsDetected: 0,
      };
    }

    // Step 2: Build text for embedding
    const textForEmbedding = [contentItem.title, contentItem.content, contentItem.authorName]
      .filter(Boolean)
      .join(' ')
      .slice(0, 8000); // Limit text size

    if (!textForEmbedding.trim()) {
      log.warn({ contentItemId }, 'No text content to process');
      return {
        contentItemId,
        success: true,
        embeddingGenerated: false,
        relationshipsDetected: 0,
      };
    }

    // Step 3: Generate embedding
    const embedding = await generateEmbedding(textForEmbedding);

    // Step 4: Process with AI (summary, key points, sentiment)
    const processedContent = await processContentWithAI(contentItem.title, contentItem.content, sourceType);

    // Step 5: Update content item with embedding and AI analysis
    await updateContentItemWithEmbedding(contentItemId, embedding, processedContent);

    // Step 6: Build search text
    const searchText = [
      contentItem.title,
      contentItem.content,
      processedContent.summary,
      processedContent.keyPoints.join(' '),
      processedContent.topics.join(' '),
    ]
      .filter(Boolean)
      .join(' ');

    // Step 7: Update search index
    await updateSearchIndex(contentItemId, searchText);

    // Step 8: Detect relationships (if not skipped)
    let relationshipsDetected = 0;
    if (!skipRelationshipDetection) {
      const relationships = await detectRelationships(contentItemId, organizationId, embedding);
      relationshipsDetected = relationships.relatedItems.length;
    }

    // Step 9: Assign to topic cluster (if not skipped)
    let topicClusterAssigned: string | undefined;
    if (!skipTopicClustering) {
      const clusterId = await assignToTopicCluster(contentItemId, organizationId, embedding);
      topicClusterAssigned = clusterId || undefined;
    }

    log.info(
      { contentItemId, relationshipsDetected, topicClusterAssigned },
      'Content processing completed successfully',
    );

    return {
      contentItemId,
      success: true,
      embeddingGenerated: true,
      relationshipsDetected,
      topicClusterAssigned,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error({ contentItemId, error: errorMessage }, 'Content processing failed');

    // Mark as failed
    await markProcessingFailed(contentItemId, errorMessage);

    if (error instanceof FatalError) {
      throw error;
    }

    return {
      contentItemId,
      success: false,
      error: errorMessage,
      embeddingGenerated: false,
      relationshipsDetected: 0,
    };
  }
}
