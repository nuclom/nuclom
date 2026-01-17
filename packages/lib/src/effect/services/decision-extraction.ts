/**
 * Decision Extraction Service using Effect-TS
 *
 * Extracts decisions, participants, and context from video transcripts
 * to build a knowledge graph of team decisions over time.
 */

import { gateway } from '@ai-sdk/gateway';
import { generateObject, jsonSchema } from 'ai';
import { Context, Effect, JSONSchema, Layer, Schedule, Schema } from 'effect';
import type { TranscriptSegment } from '../../db/schema';
import { AIServiceError } from '../errors';

// =============================================================================
// Effect Schemas for Decision Extraction
// =============================================================================

export const DecisionTypeSchema = Schema.Literal('technical', 'process', 'product', 'team', 'other');

export const DecisionStatusSchema = Schema.Literal('proposed', 'decided', 'revisited', 'superseded');

export const ParticipantSchema = Schema.Struct({
  name: Schema.String.annotations({ description: 'Name of the participant as mentioned in the transcript' }),
  role: Schema.Literal('decider', 'participant', 'mentioned').annotations({
    description: 'Role in the decision: decider (made the call), participant (discussed), mentioned (referenced)',
  }),
  attributedText: Schema.optional(Schema.String).annotations({
    description: 'What this person said that contributed to the decision',
  }),
});

export const ExternalReferenceSchema = Schema.Struct({
  type: Schema.String.annotations({
    description: 'Type of reference: github:pr, github:issue, linear:issue, notion:page, file, url, etc.',
  }),
  id: Schema.String.annotations({ description: 'The identifier (e.g., PR #123, issue key)' }),
  url: Schema.optional(Schema.String).annotations({ description: 'URL if available' }),
});

export const ExtractedDecisionSchema = Schema.Struct({
  summary: Schema.String.pipe(Schema.maxLength(500)).annotations({
    description: "Clear summary of what was decided, e.g., 'We decided to use PostgreSQL instead of MongoDB'",
  }),
  context: Schema.optional(Schema.String.pipe(Schema.maxLength(2000))).annotations({
    description: 'The surrounding discussion and context that led to this decision',
  }),
  reasoning: Schema.optional(Schema.String.pipe(Schema.maxLength(1000))).annotations({
    description: 'Why this decision was made - the rationale and factors considered',
  }),
  timestampStart: Schema.Number.annotations({
    description: 'Start timestamp in seconds where this decision is discussed',
  }),
  timestampEnd: Schema.optional(Schema.Number).annotations({
    description: 'End timestamp in seconds where this decision discussion ends',
  }),
  decisionType: DecisionTypeSchema.annotations({
    description: 'Type of decision: technical, process, product, team, or other',
  }),
  status: DecisionStatusSchema.annotations({
    description: 'Status: proposed (not final), decided (final), revisited (reconsidering), superseded (replaced)',
  }),
  confidence: Schema.Number.pipe(Schema.between(0, 100)).annotations({
    description: 'AI confidence score 0-100 that this is actually a decision',
  }),
  participants: Schema.Array(ParticipantSchema).annotations({
    description: 'People involved in making or discussing this decision',
  }),
  alternatives: Schema.optional(Schema.Array(Schema.String)).annotations({
    description: 'Alternative options that were considered but not chosen',
  }),
  externalRefs: Schema.optional(Schema.Array(ExternalReferenceSchema)).annotations({
    description: 'References to external artifacts like PRs, issues, documents mentioned',
  }),
  tags: Schema.Array(Schema.String).pipe(Schema.maxItems(10)).annotations({
    description: 'Topic tags for this decision (e.g., database, authentication, performance)',
  }),
});

export const DecisionExtractionResultSchema = Schema.Struct({
  decisions: Schema.Array(ExtractedDecisionSchema).annotations({
    description: 'List of decisions extracted from the transcript',
  }),
  totalDecisions: Schema.Number.annotations({
    description: 'Total number of decisions found',
  }),
  primaryTopics: Schema.Array(Schema.String).pipe(Schema.maxItems(5)).annotations({
    description: 'The main topics discussed in this video',
  }),
  hasActionItems: Schema.Boolean.annotations({
    description: 'Whether the video contains action items related to decisions',
  }),
});

// =============================================================================
// Types
// =============================================================================

export type DecisionType = typeof DecisionTypeSchema.Type;
export type DecisionStatus = typeof DecisionStatusSchema.Type;
export type Participant = typeof ParticipantSchema.Type;
export type ExternalReference = typeof ExternalReferenceSchema.Type;
export type ExtractedDecision = typeof ExtractedDecisionSchema.Type;
export type DecisionExtractionResult = typeof DecisionExtractionResultSchema.Type;

// =============================================================================
// JSON Schema for AI SDK
// =============================================================================

const decisionExtractionJsonSchema = jsonSchema(JSONSchema.make(DecisionExtractionResultSchema));

// =============================================================================
// Service Interface
// =============================================================================

export interface DecisionExtractionServiceInterface {
  /**
   * Extract decisions from a video transcript with timestamps
   */
  readonly extractDecisions: (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ) => Effect.Effect<DecisionExtractionResult, AIServiceError>;

  /**
   * Extract decisions from raw transcript text (without timestamps)
   */
  readonly extractDecisionsFromText: (
    transcript: string,
    videoTitle?: string,
  ) => Effect.Effect<DecisionExtractionResult, AIServiceError>;

  /**
   * Re-analyze a decision with additional context
   */
  readonly refineDecision: (
    decision: ExtractedDecision,
    additionalContext: string,
  ) => Effect.Effect<ExtractedDecision, AIServiceError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class DecisionExtraction extends Context.Tag('DecisionExtraction')<
  DecisionExtraction,
  DecisionExtractionServiceInterface
>() {}

// =============================================================================
// Retry Policy
// =============================================================================

const retryPolicy = Schedule.exponential('1 second').pipe(
  Schedule.union(Schedule.spaced('500 millis')),
  Schedule.upTo('30 seconds'),
  Schedule.jittered,
);

// =============================================================================
// Decision Extraction Prompt
// =============================================================================

const DECISION_EXTRACTION_PROMPT = `Analyze this video transcript and extract all decisions made.

For each decision, identify:
1. What was decided (clear, actionable summary)
2. When in the video (timestamp)
3. Who was involved (speakers and their roles)
4. The context and reasoning behind the decision
5. Whether it's final (decided), proposed, revisiting a previous decision, or superseding one
6. Any alternatives that were considered
7. External references mentioned (PRs, issues, documents, files)

Focus on extracting:
- **Technical decisions**: Architecture choices, technology/tool selections, implementation approaches
- **Process decisions**: Workflow changes, policies, procedures
- **Product decisions**: Features, priorities, scope changes
- **Team decisions**: Assignments, timelines, resource allocation

For each decision:
- Provide a clear, standalone summary (someone should understand the decision without context)
- Include the reasoning and factors that led to the decision
- Identify all participants and their roles (who proposed, who decided, who was mentioned)
- Extract any referenced artifacts (PRs, issues, docs, files, URLs)
- Assign a confidence score (0-100) based on how certain you are this is an actual decision

Skip:
- Casual conversation not related to decisions
- Statements that are observations, not decisions
- Questions without answers`;

// =============================================================================
// Helper Functions
// =============================================================================

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatSegmentsForPrompt = (segments: ReadonlyArray<TranscriptSegment>): string => {
  return segments.map((seg) => `[${formatTime(seg.startTime)}] ${seg.text}`).join('\n');
};

// =============================================================================
// Service Implementation
// =============================================================================

const makeDecisionExtractionService = Effect.gen(function* () {
  const model = gateway('xai/grok-3');

  const extractDecisions = (
    segments: ReadonlyArray<TranscriptSegment>,
    videoTitle?: string,
  ): Effect.Effect<DecisionExtractionResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        if (segments.length === 0) {
          return {
            decisions: [],
            totalDecisions: 0,
            primaryTopics: [],
            hasActionItems: false,
          };
        }

        const formattedTranscript = formatSegmentsForPrompt(segments);
        const totalDuration = Math.max(...segments.map((s) => s.endTime));

        const result = await generateObject({
          model,
          schema: decisionExtractionJsonSchema,
          prompt: `${DECISION_EXTRACTION_PROMPT}

${videoTitle ? `Video Title: "${videoTitle}"` : ''}
Total Duration: ${formatTime(totalDuration)}

Transcript:
${formattedTranscript}`,
        });

        return Schema.decodeUnknownSync(DecisionExtractionResultSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: 'Failed to extract decisions from transcript',
          operation: 'extractDecisions',
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          decisions: [],
          totalDecisions: 0,
          primaryTopics: [],
          hasActionItems: false,
        }),
      ),
    );

  const extractDecisionsFromText = (
    transcript: string,
    videoTitle?: string,
  ): Effect.Effect<DecisionExtractionResult, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        if (!transcript.trim()) {
          return {
            decisions: [],
            totalDecisions: 0,
            primaryTopics: [],
            hasActionItems: false,
          };
        }

        const result = await generateObject({
          model,
          schema: decisionExtractionJsonSchema,
          prompt: `${DECISION_EXTRACTION_PROMPT}

${videoTitle ? `Video Title: "${videoTitle}"` : ''}

Transcript:
${transcript.slice(0, 20000)}

Note: This transcript does not have timestamps, so use your best estimate for when decisions occur based on position in the text (estimate seconds based on typical speaking rate of ~150 words per minute).`,
        });

        return Schema.decodeUnknownSync(DecisionExtractionResultSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: 'Failed to extract decisions from text',
          operation: 'extractDecisionsFromText',
          cause: error,
        }),
    }).pipe(
      Effect.retry(retryPolicy),
      Effect.catchAll(() =>
        Effect.succeed({
          decisions: [],
          totalDecisions: 0,
          primaryTopics: [],
          hasActionItems: false,
        }),
      ),
    );

  const refineDecisionJsonSchema = jsonSchema(JSONSchema.make(ExtractedDecisionSchema));

  const refineDecision = (
    decision: ExtractedDecision,
    additionalContext: string,
  ): Effect.Effect<ExtractedDecision, AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await generateObject({
          model,
          schema: refineDecisionJsonSchema,
          prompt: `Refine this decision extraction with additional context.

Current Decision:
- Summary: ${decision.summary}
- Context: ${decision.context || 'None provided'}
- Reasoning: ${decision.reasoning || 'None provided'}
- Type: ${decision.decisionType}
- Status: ${decision.status}
- Confidence: ${decision.confidence}

Additional Context:
${additionalContext}

Please update the decision with:
1. A more accurate or complete summary if the context changes anything
2. Updated reasoning if new factors are mentioned
3. Any new participants or their roles
4. Updated confidence based on the new information
5. Any newly mentioned external references`,
        });

        return Schema.decodeUnknownSync(ExtractedDecisionSchema)(result.object);
      },
      catch: (error) =>
        new AIServiceError({
          message: 'Failed to refine decision',
          operation: 'refineDecision',
          cause: error,
        }),
    }).pipe(Effect.retry(retryPolicy));

  return {
    extractDecisions,
    extractDecisionsFromText,
    refineDecision,
  } satisfies DecisionExtractionServiceInterface;
});

// =============================================================================
// Layer
// =============================================================================

export const DecisionExtractionLive = Layer.effect(DecisionExtraction, makeDecisionExtractionService);

// =============================================================================
// Helper Functions for External Use
// =============================================================================

export const extractDecisionsFromSegments = (
  segments: ReadonlyArray<TranscriptSegment>,
  videoTitle?: string,
): Effect.Effect<DecisionExtractionResult, AIServiceError, DecisionExtraction> =>
  Effect.gen(function* () {
    const service = yield* DecisionExtraction;
    return yield* service.extractDecisions(segments, videoTitle);
  });

export const extractDecisionsFromTranscript = (
  transcript: string,
  videoTitle?: string,
): Effect.Effect<DecisionExtractionResult, AIServiceError, DecisionExtraction> =>
  Effect.gen(function* () {
    const service = yield* DecisionExtraction;
    return yield* service.extractDecisionsFromText(transcript, videoTitle);
  });
