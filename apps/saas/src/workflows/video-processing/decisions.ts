/**
 * Decision Extraction
 *
 * Functions for extracting decisions from video transcripts using AI.
 */

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { createWorkflowLogger } from '../workflow-logger';
import type { ExtractedDecisionResult } from './types';

const log = createWorkflowLogger('video-processing:decisions');

/**
 * Extract decisions from video transcript using AI
 */
export async function extractDecisions(
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<ExtractedDecisionResult> {
  'use step';

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateObject, jsonSchema } = await import('ai');

  // Use Vercel AI Gateway
  const model = gateway('xai/grok-3');

  const decisionSchema = jsonSchema<ExtractedDecisionResult>({
    type: 'object',
    properties: {
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Clear summary of what was decided' },
            context: { type: 'string', description: 'Discussion context that led to the decision' },
            reasoning: { type: 'string', description: 'Why this decision was made' },
            timestampStart: { type: 'number', description: 'Start time in seconds' },
            timestampEnd: { type: 'number', description: 'End time in seconds' },
            decisionType: {
              type: 'string',
              enum: ['technical', 'process', 'product', 'team', 'other'],
              description: 'Type of decision',
            },
            status: {
              type: 'string',
              enum: ['proposed', 'decided', 'revisited', 'superseded'],
              description: 'Decision status',
            },
            confidence: { type: 'number', description: 'AI confidence 0-100' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Topic tags' },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Participant name' },
                  role: {
                    type: 'string',
                    enum: ['decider', 'participant', 'mentioned'],
                    description: 'Role in decision',
                  },
                  attributedText: { type: 'string', description: 'What they said' },
                },
                required: ['name', 'role'],
              },
              description: 'Decision participants',
            },
            externalRefs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Reference type (github:pr, linear:issue, etc.)' },
                  id: { type: 'string', description: 'Reference identifier' },
                  url: { type: 'string', description: 'URL if available' },
                },
                required: ['type', 'id'],
              },
              description: 'External references mentioned',
            },
          },
          required: ['summary', 'timestampStart', 'decisionType', 'status', 'confidence', 'tags', 'participants'],
        },
        description: 'Extracted decisions',
      },
      totalDecisions: { type: 'number', description: 'Total decisions found' },
      primaryTopics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Main topics discussed',
      },
    },
    required: ['decisions', 'totalDecisions', 'primaryTopics'],
  });

  // Format transcript with timestamps
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formattedTranscript = segments.map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`).join('\n');

  try {
    const result = await generateObject({
      model,
      schema: decisionSchema,
      prompt: `Analyze this video transcript and extract ALL decisions, agreements, conclusions, and commitments made.

## What Counts as a Decision
Be INCLUSIVE - extract anything that represents:
- **Explicit decisions**: "We decided...", "Let's go with...", "We'll use..."
- **Implicit agreements**: "Sounds good", "That works", "Makes sense, let's do that"
- **Conclusions reached**: "So we're going to...", "The plan is to...", "We'll proceed with..."
- **Commitments made**: "I'll take care of...", "We should...", "Let's..."
- **Choices between options**: Any time one approach was chosen over another
- **Plans established**: "Next steps are...", "The approach will be...", "We're planning to..."
- **Recommendations accepted**: "Good idea, let's do that", "I agree with..."
- **Direction set**: "Going forward we'll...", "From now on...", "The way we'll handle this..."

## Decision Categories
- **Technical**: Architecture, technology choices, implementation approaches, APIs, frameworks, tools, code patterns
- **Process**: Workflows, meetings, communication, documentation, reviews, approvals
- **Product**: Features, priorities, scope, user experience, requirements, specifications
- **Team**: Assignments, responsibilities, timelines, deadlines, resource allocation
- **Other**: Any other significant agreement or conclusion

## For Each Decision, Extract:
1. **Summary**: Clear, standalone description (understandable without context)
2. **Timestamp**: When it occurred in the video
3. **Participants**: Who was involved and their role (decider, participant, or mentioned)
4. **Context**: The discussion that led to this decision
5. **Reasoning**: Why this choice was made (if stated or implied)
6. **Status**: proposed (still discussing), decided (agreed upon), revisited (reconsidering), superseded (replaced)
7. **External refs**: Any PRs, issues, documents, files, or tools mentioned

## Confidence Scoring Guidelines
- 90-100: Explicit decision with clear language ("We decided to...")
- 70-89: Strong implicit agreement ("Sounds good, let's do that")
- 50-69: Probable decision/conclusion (direction was set but language was less explicit)
- 30-49: Possible decision (implied agreement or tentative plan)
- Below 30: Too uncertain to include

Be generous in extraction - it's better to capture a potential decision than miss an important one. Even informal agreements in casual conversation can be valuable decisions to track.

${videoTitle ? `Video Title: "${videoTitle}"` : ''}

Transcript:
${formattedTranscript}`,
    });

    return result.object as ExtractedDecisionResult;
  } catch (error) {
    log.error({ error }, 'Failed to extract decisions');
    return {
      decisions: [],
      totalDecisions: 0,
      primaryTopics: [],
    };
  }
}

/**
 * Log diagnostic information about extracted decisions before saving.
 * This helps debug when decisions aren't showing up in the UI.
 */
export function logDecisionDiagnostics(
  videoId: string,
  extractedDecisions: ExtractedDecisionResult,
  confidenceThreshold: number,
): void {
  const total = extractedDecisions.decisions.length;
  const aboveThreshold = extractedDecisions.decisions.filter((d) => d.confidence >= confidenceThreshold).length;
  const belowThreshold = total - aboveThreshold;

  log.info(
    {
      videoId,
      totalExtracted: total,
      aboveThreshold,
      belowThreshold,
      confidenceThreshold,
      primaryTopics: extractedDecisions.primaryTopics,
    },
    'Decision extraction diagnostics',
  );

  if (total > 0) {
    // Log details of each decision for debugging
    for (const decision of extractedDecisions.decisions) {
      log.info(
        {
          videoId,
          summary: decision.summary.slice(0, 100),
          confidence: decision.confidence,
          type: decision.decisionType,
          status: decision.status,
          willBeSaved: decision.confidence >= confidenceThreshold,
        },
        'Extracted decision detail',
      );
    }
  } else {
    log.warn(
      { videoId, segmentCount: extractedDecisions.totalDecisions },
      'No decisions extracted from video - this may indicate the content has no explicit decisions or the AI could not identify them',
    );
  }
}

/**
 * Save extracted decisions to the database
 */
export async function saveDecisions(
  videoId: string,
  organizationId: string,
  extractedDecisions: ExtractedDecisionResult,
): Promise<void> {
  'use step';

  if (extractedDecisions.decisions.length === 0) {
    return;
  }

  const { db } = await import('@nuclom/lib/db');
  const { decisions, decisionParticipants, decisionLinks } = await import('@nuclom/lib/db/schema');

  try {
    for (const extracted of extractedDecisions.decisions) {
      // Only save decisions with sufficient confidence (lowered from 50 to 30 to capture more decisions)
      if (extracted.confidence < 30) {
        continue;
      }

      // Create the decision record
      const [decision] = await db
        .insert(decisions)
        .values({
          organizationId,
          videoId,
          summary: extracted.summary,
          context: extracted.context,
          reasoning: extracted.reasoning,
          timestampStart: extracted.timestampStart,
          timestampEnd: extracted.timestampEnd,
          decisionType: extracted.decisionType,
          status: extracted.status,
          confidence: extracted.confidence,
          tags: extracted.tags,
          metadata: extracted.externalRefs ? { externalRefs: extracted.externalRefs } : undefined,
        })
        .returning();

      // Add participants
      if (extracted.participants.length > 0) {
        const participantData = extracted.participants.map(
          (p: { name: string; role: 'decider' | 'participant' | 'mentioned'; attributedText?: string }) => ({
            decisionId: decision.id,
            userId: null,
            speakerName: p.name,
            role: p.role,
            attributedText: p.attributedText,
          }),
        );
        await db.insert(decisionParticipants).values(participantData);
      }

      // Add links for external references
      if (extracted.externalRefs && extracted.externalRefs.length > 0) {
        const linkData = extracted.externalRefs.map((ref) => ({
          decisionId: decision.id,
          entityType: ref.type.split(':')[0] ?? ref.type,
          entityId: ref.id,
          entityRef: ref.id,
          linkType: 'references',
          url: ref.url,
        }));
        await db.insert(decisionLinks).values(linkData);
      }
    }

    log.info(
      { videoId, decisionCount: extractedDecisions.decisions.filter((d) => d.confidence >= 50).length },
      'Saved extracted decisions',
    );
  } catch (error) {
    log.error({ error, videoId }, 'Failed to save decisions');
  }
}
