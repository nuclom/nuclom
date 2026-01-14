/**
 * Video Processing Workflow using Workflow DevKit
 *
 * Handles the complete video processing pipeline with durable execution:
 * 1. Transcription (audio to text)
 * 2. Thumbnail generation
 * 3. Speaker Diarization (who spoke when)
 * 4. AI Analysis (summary, tags, action items)
 * 5. Code snippet detection
 * 6. Chapter generation
 * 7. Decision extraction (knowledge graph)
 * 8. Database storage of results
 *
 * Benefits over fire-and-forget:
 * - Automatic retries on transient failures
 * - Resume from last successful step if server restarts
 * - Built-in observability for debugging
 * - No lost processing on deploy
 */

import { FatalError, sleep } from 'workflow';
import type { ActionItem, DecisionStatus, DecisionType, ProcessingStatus, TranscriptSegment } from '@/lib/db/schema';
import { createWorkflowLogger } from './workflow-logger';

const log = createWorkflowLogger('video-processing');

// =============================================================================
// Types
// =============================================================================

export interface VideoProcessingInput {
  readonly videoId: string;
  readonly videoUrl: string;
  readonly videoTitle?: string;
  readonly organizationId?: string;
  readonly skipDiarization?: boolean;
  /** Participant names for improved transcription accuracy */
  readonly participantNames?: string[];
}

export interface VideoProcessingResult {
  readonly videoId: string;
  readonly success: boolean;
  readonly error?: string;
}

interface TranscriptionResult {
  transcript: string;
  segments: TranscriptSegment[];
  duration: number;
  language?: string;
}

interface DiarizedSegment {
  speaker: string;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
  confidence: number;
}

interface SpeakerSummary {
  speaker: string;
  totalSpeakingTime: number; // milliseconds
  segmentCount: number;
  speakingPercentage: number;
}

interface DiarizationResult {
  transcript: string;
  segments: DiarizedSegment[];
  speakers: SpeakerSummary[];
  duration: number;
  language?: string;
  speakerCount: number;
}

interface AIAnalysisResult {
  summary: string;
  tags: string[];
  actionItems: ActionItem[];
  chapters: Array<{
    title: string;
    summary: string;
    startTime: number;
    endTime?: number;
  }>;
}

interface DetectedMoment {
  title: string;
  description?: string;
  startTime: number;
  endTime: number;
  momentType:
    | 'decision'
    | 'action_item'
    | 'question'
    | 'answer'
    | 'emphasis'
    | 'demonstration'
    | 'conclusion'
    | 'highlight';
  confidence: number;
  transcriptExcerpt: string;
}

interface ExtractedDecisionResult {
  decisions: Array<{
    summary: string;
    context?: string;
    reasoning?: string;
    timestampStart: number;
    timestampEnd?: number;
    decisionType: DecisionType;
    status: DecisionStatus;
    confidence: number;
    tags: string[];
    participants: Array<{
      name: string;
      role: 'decider' | 'participant' | 'mentioned';
      attributedText?: string;
    }>;
    externalRefs?: Array<{
      type: string;
      id: string;
      url?: string;
    }>;
  }>;
  totalDecisions: number;
  primaryTopics: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch vocabulary terms for an organization to improve transcription accuracy
 */
async function getVocabularyTerms(organizationId: string): Promise<string[]> {
  'use step';

  const { db } = await import('@/lib/db');
  const { organizationVocabulary } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const vocabulary = await db.query.organizationVocabulary.findMany({
      where: eq(organizationVocabulary.organizationId, organizationId),
      columns: { term: true },
    });

    return vocabulary.map((v) => v.term);
  } catch (error) {
    log.warn({ organizationId, error }, 'Failed to fetch vocabulary terms');
    return [];
  }
}

/**
 * Apply vocabulary corrections to transcript text and segments
 */
async function applyVocabularyCorrections(
  organizationId: string,
  transcript: string,
  segments: TranscriptSegment[],
): Promise<{ transcript: string; segments: TranscriptSegment[] }> {
  'use step';

  const { db } = await import('@/lib/db');
  const { organizationVocabulary } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const vocabulary = await db.query.organizationVocabulary.findMany({
      where: eq(organizationVocabulary.organizationId, organizationId),
      columns: { term: true, variations: true },
    });

    if (vocabulary.length === 0) {
      return { transcript, segments };
    }

    // Apply corrections to transcript
    let correctedTranscript = transcript;
    for (const vocab of vocabulary) {
      for (const variation of vocab.variations) {
        // Case-insensitive word boundary replacement
        const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
        correctedTranscript = correctedTranscript.replace(regex, vocab.term);
      }
    }

    // Apply corrections to segments
    const correctedSegments = segments.map((segment) => {
      let correctedText = segment.text;
      for (const vocab of vocabulary) {
        for (const variation of vocab.variations) {
          const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
          correctedText = correctedText.replace(regex, vocab.term);
        }
      }
      return { ...segment, text: correctedText };
    });

    log.info({ organizationId, correctionCount: vocabulary.length }, 'Applied vocabulary corrections');

    return { transcript: correctedTranscript, segments: correctedSegments };
  } catch (error) {
    log.warn({ organizationId, error }, 'Failed to apply vocabulary corrections');
    return { transcript, segments };
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function generateAndUploadThumbnail(
  videoId: string,
  videoUrl: string,
  organizationId: string,
): Promise<string | null> {
  'use step';

  const { env } = await import('@/lib/env/server');
  const replicateToken = env.REPLICATE_API_TOKEN;
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (!replicateToken) {
    log.info({}, 'Replicate not configured, skipping thumbnail generation');
    return null;
  }

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    log.info({}, 'R2 storage not configured, skipping thumbnail generation');
    return null;
  }

  try {
    const { default: Replicate } = await import('replicate');
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const replicate = new Replicate({ auth: replicateToken });

    // Use lucataco/frame-extractor to extract a frame as a static image thumbnail
    // This is fast (uses OpenCV) and produces a static image instead of a GIF
    // Note: Only supports first/last frame, not arbitrary timestamps
    const FRAME_EXTRACTOR_MODEL = 'lucataco/frame-extractor';

    const output = await replicate.run(FRAME_EXTRACTOR_MODEL as `${string}/${string}`, {
      input: {
        video: videoUrl,
        return_first_frame: false, // Use last frame to avoid black intro screens
      },
    });

    // The model returns a single URI string
    const generatedUrl = typeof output === 'string' ? output : null;

    if (!generatedUrl) {
      log.warn({ videoId }, 'No thumbnail URL returned from Replicate');
      return null;
    }

    // Download the generated thumbnail
    const response = await fetch(generatedUrl);
    if (!response.ok) {
      log.warn({ videoId, status: response.status }, 'Failed to download generated thumbnail');
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type and extension (frame-extractor returns PNG images)
    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';

    // Upload to R2 storage
    const thumbnailKey = `${organizationId}/thumbnails/${Date.now()}-${videoId}.${extension}`;

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: thumbnailKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const thumbnailUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${thumbnailKey}`;

    log.info({ videoId, thumbnailUrl }, 'Thumbnail generated and uploaded successfully');

    return thumbnailUrl;
  } catch (error) {
    log.error({ error, videoId }, 'Failed to generate thumbnail, continuing without it');
    return null;
  }
}

async function saveThumbnailUrl(videoId: string, thumbnailUrl: string): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { videos } = await import('@/lib/db/schema');

  await db
    .update(videos)
    .set({
      thumbnailUrl,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function updateProcessingStatus(videoId: string, status: ProcessingStatus, error?: string): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { videos } = await import('@/lib/db/schema');

  await db
    .update(videos)
    .set({
      processingStatus: status,
      processingError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function transcribeVideo(
  videoUrl: string,
  options?: { vocabularyTerms?: string[]; participantNames?: string[] },
): Promise<TranscriptionResult> {
  'use step';

  const { env } = await import('@/lib/env/server');
  const replicateToken = env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new FatalError('Replicate API token not configured. Please set REPLICATE_API_TOKEN.');
  }

  // Use Replicate's Whisper model for transcription
  // This keeps all AI services routed through managed gateways/services
  const { default: Replicate } = await import('replicate');
  const replicate = new Replicate({ auth: replicateToken });

  const WHISPER_MODEL = 'openai/whisper:8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e';

  // Build initial_prompt from vocabulary terms and participant names
  // This biases Whisper toward recognizing these terms correctly
  const promptTerms: string[] = [];
  if (options?.vocabularyTerms && options.vocabularyTerms.length > 0) {
    promptTerms.push(...options.vocabularyTerms);
  }
  if (options?.participantNames && options.participantNames.length > 0) {
    promptTerms.push(...options.participantNames);
  }
  const initialPrompt = promptTerms.length > 0 ? promptTerms.join(', ') : undefined;

  if (initialPrompt) {
    log.info({ termCount: promptTerms.length }, 'Using vocabulary-aware transcription');
  }

  const output = (await replicate.run(WHISPER_MODEL as `${string}/${string}`, {
    input: {
      audio: videoUrl,
      model: 'large-v3',
      translate: false,
      temperature: 0,
      transcription: 'plain text',
      suppress_tokens: '-1',
      logprob_threshold: -1,
      no_speech_threshold: 0.6,
      condition_on_previous_text: true,
      compression_ratio_threshold: 2.4,
      // Vocabulary injection: initial_prompt biases the model toward these terms
      ...(initialPrompt && { initial_prompt: initialPrompt }),
    },
  })) as {
    transcription?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    detected_language?: string;
  };

  const segments: TranscriptSegment[] = (output.segments || []).map((seg) => ({
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text.trim(),
  }));

  // Calculate duration from segments if available
  const duration = segments.length > 0 ? Math.max(...segments.map((s) => s.endTime)) : 0;

  return {
    transcript: output.transcription || '',
    segments,
    duration,
    language: output.detected_language,
  };
}

async function analyzeWithAI(
  transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<AIAnalysisResult> {
  'use step';

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateText, generateObject, jsonSchema } = await import('ai');

  // Use Vercel AI Gateway for all AI operations
  const model = gateway('xai/grok-3');

  // Define schemas for structured outputs
  const tagsSchema = jsonSchema<{ tags: string[] }>({
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '5-10 relevant tags for the video',
      },
    },
    required: ['tags'],
  });

  const actionItemsSchema = jsonSchema<{
    items: Array<{ text: string; timestamp?: number; priority?: 'high' | 'medium' | 'low' }>;
  }>({
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The action item description' },
            timestamp: { type: 'number', description: 'Approximate timestamp in seconds' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
          },
          required: ['text'],
        },
        description: 'List of action items extracted from the transcript',
      },
    },
    required: ['items'],
  });

  const chaptersSchema = jsonSchema<{
    chapters: Array<{ title: string; summary: string; startTime: number; endTime?: number }>;
  }>({
    type: 'object',
    properties: {
      chapters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Chapter title' },
            summary: { type: 'string', description: 'Brief chapter summary' },
            startTime: { type: 'number', description: 'Start time in seconds' },
            endTime: { type: 'number', description: 'End time in seconds' },
          },
          required: ['title', 'summary', 'startTime'],
        },
        description: 'Video chapters based on topic changes',
      },
    },
    required: ['chapters'],
  });

  // Generate summary using Vercel AI SDK
  const summaryResult = await generateText({
    model,
    system:
      'You are a helpful assistant that summarizes video transcripts. Provide a concise summary in 2-3 paragraphs.',
    prompt: `Please summarize this video transcript:\n\n${transcript.slice(0, 10000)}`,
  });

  const summary = summaryResult.text || 'Summary generation failed';

  // Generate tags using structured output
  let tags: string[] = [];
  try {
    const tagsResult = await generateObject({
      model,
      schema: tagsSchema,
      system: 'Generate 5-10 relevant tags for this video based on its title and content.',
      prompt: `Title: ${videoTitle || 'Untitled'}\n\nTranscript excerpt: ${transcript.slice(0, 2000)}`,
    });
    tags = Array.isArray(tagsResult.object?.tags) ? tagsResult.object.tags : [];
  } catch {
    tags = [];
  }

  // Extract action items using structured output
  let actionItems: ActionItem[] = [];
  try {
    const actionItemsResult = await generateObject({
      model,
      schema: actionItemsSchema,
      system: `Extract action items from this transcript. Include:
- text: the action item description
- timestamp: approximate timestamp in seconds (if mentioned)
- priority: "high", "medium", or "low" based on urgency`,
      prompt: transcript.slice(0, 8000),
    });
    actionItems = Array.isArray(actionItemsResult.object?.items) ? actionItemsResult.object.items : [];
  } catch {
    actionItems = [];
  }

  // Generate chapters using structured output
  let chapters: AIAnalysisResult['chapters'] = [];
  try {
    const chaptersResult = await generateObject({
      model,
      schema: chaptersSchema,
      system: `Analyze this transcript and create chapters. For each chapter include:
- title: chapter title
- summary: brief chapter summary
- startTime: start time in seconds
- endTime: end time in seconds (optional)`,
      prompt: `Transcript with timestamps:\n${segments
        .slice(0, 100)
        .map((s) => `[${s.startTime}s] ${s.text}`)
        .join('\n')}`,
    });
    chapters = Array.isArray(chaptersResult.object?.chapters) ? chaptersResult.object.chapters : [];
  } catch {
    chapters = [];
  }

  return {
    summary,
    tags,
    actionItems,
    chapters,
  };
}

async function saveTranscript(
  videoId: string,
  transcript: string,
  segments: TranscriptSegment[],
  durationSeconds: number,
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { videos } = await import('@/lib/db/schema');
  const { formatDuration } = await import('@/lib/format-utils');

  await db
    .update(videos)
    .set({
      transcript,
      transcriptSegments: segments,
      duration: formatDuration(durationSeconds),
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));
}

async function detectKeyMoments(
  _transcript: string,
  segments: TranscriptSegment[],
  videoTitle?: string,
): Promise<DetectedMoment[]> {
  'use step';

  const { gateway } = await import('@ai-sdk/gateway');
  const { generateObject, jsonSchema } = await import('ai');

  // Use Vercel AI Gateway
  const model = gateway('xai/grok-3');

  // Schema for moment detection
  const momentsSchema = jsonSchema<{
    moments: Array<{
      title: string;
      description?: string;
      startTime: number;
      endTime: number;
      momentType:
        | 'decision'
        | 'action_item'
        | 'question'
        | 'answer'
        | 'emphasis'
        | 'demonstration'
        | 'conclusion'
        | 'highlight';
      confidence: number;
      transcriptExcerpt: string;
    }>;
  }>({
    type: 'object',
    properties: {
      moments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A concise title for the moment (max 100 chars)' },
            description: { type: 'string', description: 'Brief description of what happens in this moment' },
            startTime: { type: 'number', description: 'Start time in seconds' },
            endTime: { type: 'number', description: 'End time in seconds' },
            momentType: {
              type: 'string',
              enum: [
                'decision',
                'action_item',
                'question',
                'answer',
                'emphasis',
                'demonstration',
                'conclusion',
                'highlight',
              ],
              description: 'Type of moment detected',
            },
            confidence: { type: 'number', description: 'Confidence score 0-100' },
            transcriptExcerpt: { type: 'string', description: 'The relevant transcript excerpt for this moment' },
          },
          required: ['title', 'startTime', 'endTime', 'momentType', 'confidence', 'transcriptExcerpt'],
        },
        description: 'Key moments detected in the video',
      },
    },
    required: ['moments'],
  });

  // Prepare transcript with timestamps
  const timestampedTranscript = segments
    .map((s) => `[${Math.floor(s.startTime)}s-${Math.floor(s.endTime)}s] ${s.text}`)
    .join('\n');

  try {
    const result = await generateObject({
      model,
      schema: momentsSchema,
      system: `You are an expert at analyzing video transcripts to identify key moments worth sharing or highlighting.

Detect the following types of moments:
- **decision**: Moments where a decision is made or announced (e.g., "We've decided to...", "Let's go with...")
- **action_item**: Tasks or next steps assigned (e.g., "I'll take care of...", "Next steps are...")
- **question**: Important questions raised
- **answer**: Key answers or explanations given
- **emphasis**: Points that are emphasized or repeated for importance
- **demonstration**: Moments where something is being shown or demonstrated (e.g., "Let me show you...", "As you can see...")
- **conclusion**: Summary statements or wrap-up points (e.g., "In summary...", "To wrap up...")
- **highlight**: Other noteworthy moments worth sharing

For each moment:
1. Identify the exact timestamp range from the transcript
2. Assign a confidence score (0-100) based on how clearly the moment fits its category
3. Extract the relevant transcript excerpt
4. Create a concise, descriptive title`,
      prompt: `Video Title: ${videoTitle || 'Untitled'}

Transcript with timestamps:
${timestampedTranscript.slice(0, 15000)}

Analyze this transcript and identify key moments. Focus on finding:
1. Decision moments
2. Action items and next steps
3. Important Q&A exchanges
4. Points of emphasis
5. Demonstrations or walkthroughs
6. Conclusions and summaries

Return only moments with confidence >= 60.`,
    });

    return Array.isArray(result.object?.moments) ? result.object.moments : [];
  } catch (error) {
    log.error({ error }, 'Failed to detect key moments');
    return [];
  }
}

async function saveKeyMoments(videoId: string, organizationId: string, moments: DetectedMoment[]): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { videoMoments } = await import('@/lib/db/schema');

  if (moments.length === 0) return;

  // Delete existing moments for this video
  await db.delete(videoMoments).where(eq(videoMoments.videoId, videoId));

  // Insert new moments
  await db.insert(videoMoments).values(
    moments.map((moment) => ({
      videoId,
      organizationId,
      title: moment.title.slice(0, 200), // Ensure title fits
      description: moment.description?.slice(0, 1000),
      startTime: Math.floor(moment.startTime),
      endTime: Math.floor(moment.endTime),
      momentType: moment.momentType,
      confidence: Math.min(100, Math.max(0, Math.floor(moment.confidence))),
      transcriptExcerpt: moment.transcriptExcerpt.slice(0, 5000),
    })),
  );
}

/**
 * Perform speaker diarization using AssemblyAI
 * Falls back gracefully if not configured
 */
async function diarizeVideo(videoUrl: string): Promise<DiarizationResult | null> {
  'use step';

  const { env } = await import('@/lib/env/server');
  const apiKey = env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    log.info({}, 'AssemblyAI not configured, skipping speaker diarization');
    return null;
  }

  const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';
  const MAX_POLLING_ATTEMPTS = 200; // ~10 minutes with 3-second intervals

  try {
    // Submit transcription request with speaker labels
    const submitResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: videoUrl,
        speaker_labels: true,
        punctuate: true,
        format_text: true,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`AssemblyAI submit error: ${submitResponse.status} - ${errorText}`);
    }

    const { id: transcriptId } = (await submitResponse.json()) as { id: string };

    // Poll for completion
    for (let attempt = 0; attempt < MAX_POLLING_ATTEMPTS; attempt++) {
      const statusResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: { Authorization: apiKey },
      });

      if (!statusResponse.ok) {
        throw new Error(`AssemblyAI status error: ${statusResponse.status}`);
      }

      const result = (await statusResponse.json()) as {
        status: 'queued' | 'processing' | 'completed' | 'error';
        text?: string;
        utterances?: Array<{
          speaker: string;
          start: number;
          end: number;
          text: string;
          confidence: number;
        }>;
        audio_duration?: number;
        language_code?: string;
        error?: string;
      };

      if (result.status === 'completed') {
        const utterances = result.utterances || [];
        const durationMs = (result.audio_duration || 0) * 1000;

        // Convert to our format
        const segments: DiarizedSegment[] = utterances.map((u) => ({
          speaker: u.speaker,
          start: u.start,
          end: u.end,
          text: u.text,
          confidence: u.confidence,
        }));

        // Calculate speaker stats
        const speakerStats = new Map<string, { time: number; count: number }>();
        for (const segment of segments) {
          const duration = segment.end - segment.start;
          const existing = speakerStats.get(segment.speaker) || { time: 0, count: 0 };
          speakerStats.set(segment.speaker, {
            time: existing.time + duration,
            count: existing.count + 1,
          });
        }

        const totalSpeakingTime = Array.from(speakerStats.values()).reduce((sum, s) => sum + s.time, 0);

        const speakers: SpeakerSummary[] = Array.from(speakerStats.entries())
          .map(([speaker, stats]) => ({
            speaker,
            totalSpeakingTime: stats.time,
            segmentCount: stats.count,
            speakingPercentage: totalSpeakingTime > 0 ? Math.round((stats.time / totalSpeakingTime) * 100) : 0,
          }))
          .sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);

        return {
          transcript: result.text || '',
          segments,
          speakers,
          duration: durationMs,
          language: result.language_code,
          speakerCount: speakers.length,
        };
      }

      if (result.status === 'error') {
        throw new Error(result.error || 'Diarization failed');
      }

      // Wait before next poll using workflow-native sleep (durable, no resource consumption)
      await sleep('3 seconds');
    }

    throw new Error('Diarization timed out');
  } catch (error) {
    log.error({ error }, 'Speaker diarization failed, continuing without speaker data');
    return null;
  }
}

/**
 * Save speaker diarization results to the database
 */
async function saveSpeakerData(videoId: string, organizationId: string, diarization: DiarizationResult): Promise<void> {
  'use step';

  const { db } = await import('@/lib/db');
  const { speakerProfiles, videoSpeakers, speakerSegments } = await import('@/lib/db/schema');

  // Create video speakers and map speaker labels to IDs
  const speakerMap = new Map<string, string>();

  for (const speakerSummary of diarization.speakers) {
    // Check if a speaker profile already exists for this organization with matching label pattern
    // For now, we create anonymous speaker profiles that can be linked to users later
    const [profile] = await db
      .insert(speakerProfiles)
      .values({
        organizationId,
        displayName: `Speaker ${speakerSummary.speaker}`,
      })
      .returning();

    // Create the video speaker record
    const [videoSpeaker] = await db
      .insert(videoSpeakers)
      .values({
        videoId,
        speakerProfileId: profile.id,
        speakerLabel: speakerSummary.speaker,
        totalSpeakingTime: Math.round(speakerSummary.totalSpeakingTime / 1000), // Convert to seconds
        segmentCount: speakerSummary.segmentCount,
        speakingPercentage: speakerSummary.speakingPercentage,
      })
      .returning();

    speakerMap.set(speakerSummary.speaker, videoSpeaker.id);
  }

  // Save individual segments in batches
  const BATCH_SIZE = 100;
  const segmentsToInsert = diarization.segments
    .filter((seg) => speakerMap.has(seg.speaker))
    .map((seg) => ({
      videoId,
      videoSpeakerId: speakerMap.get(seg.speaker) as string,
      startTime: seg.start,
      endTime: seg.end,
      transcriptText: seg.text,
      confidence: Math.round(seg.confidence * 100),
    }));

  for (let i = 0; i < segmentsToInsert.length; i += BATCH_SIZE) {
    const batch = segmentsToInsert.slice(i, i + BATCH_SIZE);
    await db.insert(speakerSegments).values(batch);
  }

  log.info(
    { videoId, speakerCount: diarization.speakerCount, segmentCount: diarization.segments.length },
    'Saved speaker diarization data',
  );
}

async function saveAIAnalysis(videoId: string, analysis: AIAnalysisResult): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { videos, videoChapters } = await import('@/lib/db/schema');

  // Update video record
  await db
    .update(videos)
    .set({
      aiSummary: analysis.summary,
      aiTags: analysis.tags,
      aiActionItems: analysis.actionItems,
      updatedAt: new Date(),
    })
    .where(eq(videos.id, videoId));

  // Save chapters
  if (analysis.chapters.length > 0) {
    await db.delete(videoChapters).where(eq(videoChapters.videoId, videoId));
    await db.insert(videoChapters).values(
      analysis.chapters.map((chapter) => ({
        videoId,
        title: chapter.title,
        summary: chapter.summary,
        startTime: Math.floor(chapter.startTime),
        endTime: chapter.endTime ? Math.floor(chapter.endTime) : null,
      })),
    );
  }
}

async function extractDecisions(segments: TranscriptSegment[], videoTitle?: string): Promise<ExtractedDecisionResult> {
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
function logDecisionDiagnostics(
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

async function saveDecisions(
  videoId: string,
  organizationId: string,
  extractedDecisions: ExtractedDecisionResult,
): Promise<void> {
  'use step';

  if (extractedDecisions.decisions.length === 0) {
    return;
  }

  const { db } = await import('@/lib/db');
  const { decisions, decisionParticipants, decisionLinks } = await import('@/lib/db/schema');

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

async function sendCompletionNotification(
  videoId: string,
  status: 'completed' | 'failed',
  errorMessage?: string,
): Promise<void> {
  'use step';

  try {
    const { db } = await import('@/lib/db');
    const { notifications } = await import('@/lib/db/schema');
    const { resend } = await import('@/lib/email');
    const { env, getAppUrl } = await import('@/lib/env/server');
    const { notifySlackMonitoring } = await import('@/lib/effect/services/slack-monitoring');

    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    });

    if (!video || !video.authorId) return;

    const authorId = video.authorId;
    const user = await db.query.users.findFirst({
      where: (u, { eq: eqOp }) => eqOp(u.id, authorId),
    });

    if (!user?.email) return;

    const baseUrl = getAppUrl();

    // Create in-app notification
    await db.insert(notifications).values({
      userId: user.id,
      type: status === 'completed' ? 'video_processing_complete' : 'video_processing_failed',
      title: status === 'completed' ? 'Video processing complete' : 'Video processing failed',
      body:
        status === 'completed'
          ? `"${video.title}" has finished processing and is now ready to view with AI insights.`
          : `"${video.title}" failed to process. ${errorMessage || 'Please try again.'}`,
      resourceType: 'video',
      resourceId: videoId,
    });

    // Send email notification
    const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@nuclom.com';
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject:
        status === 'completed' ? `Your video "${video.title}" is ready!` : `Video processing failed: "${video.title}"`,
      html: `
        <h2>${status === 'completed' ? 'Video Processing Complete' : 'Video Processing Failed'}</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p>${
          status === 'completed'
            ? `Your video "${video.title}" has finished processing and is now ready with AI-generated summaries, transcriptions, and more.`
            : `Your video "${video.title}" failed to process. ${errorMessage || 'Please try again.'}`
        }</p>
        <p><a href="${baseUrl}/videos/${videoId}">View Video</a></p>
      `,
    });

    // Send Slack monitoring notification
    await notifySlackMonitoring(status === 'completed' ? 'video_processed' : 'video_processing_failed', {
      videoId,
      videoTitle: video.title,
      organizationId: video.organizationId,
      userId: user.id,
      userName: user.name || undefined,
      errorMessage: status === 'failed' ? errorMessage : undefined,
    });
  } catch (error) {
    log.error({ videoId, status, error }, 'Failed to send notification');
  }
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Handle workflow failure by updating status and sending notification.
 * This is a separate step so the static analyzer can trace it.
 */
async function handleWorkflowFailure(videoId: string, errorMessage: string): Promise<VideoProcessingResult> {
  'use step';

  try {
    const { eq } = await import('drizzle-orm');
    const { db } = await import('@/lib/db');
    const { videos, notifications } = await import('@/lib/db/schema');
    const { resend } = await import('@/lib/email');
    const { env, getAppUrl } = await import('@/lib/env/server');
    const { notifySlackMonitoring } = await import('@/lib/effect/services/slack-monitoring');

    // Update video status to failed
    await db
      .update(videos)
      .set({
        processingStatus: 'failed',
        processingError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    // Get video and user info for notification
    const video = await db.query.videos.findFirst({
      where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    });

    if (video?.authorId) {
      const authorId = video.authorId;
      const user = await db.query.users.findFirst({
        where: (u, { eq: eqOp }) => eqOp(u.id, authorId),
      });

      if (user?.email) {
        const baseUrl = getAppUrl();

        // Create in-app notification
        await db.insert(notifications).values({
          userId: user.id,
          type: 'video_processing_failed',
          title: 'Video processing failed',
          body: `"${video.title}" failed to process. ${errorMessage}`,
          resourceType: 'video',
          resourceId: videoId,
        });

        // Send email notification
        const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@nuclom.com';
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: `Video processing failed: "${video.title}"`,
          html: `
            <h2>Video Processing Failed</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your video "${video.title}" failed to process. ${errorMessage}</p>
            <p><a href="${baseUrl}/videos/${videoId}">View Video</a></p>
          `,
        });

        // Send Slack monitoring notification
        await notifySlackMonitoring('video_processing_failed', {
          videoId,
          videoTitle: video.title,
          organizationId: video.organizationId,
          userId: user.id,
          userName: user.name || undefined,
          errorMessage,
        });
      }
    }
  } catch (notifyError) {
    log.error({ videoId, notifyError }, 'Failed to send failure notification');
  }

  return {
    videoId,
    success: false,
    error: errorMessage,
  };
}

/**
 * Get organization ID from video if not provided in input.
 * This is a separate step for traceability.
 */
async function getVideoOrganizationId(videoId: string): Promise<string | null> {
  'use step';

  const { db } = await import('@/lib/db');
  const video = await db.query.videos.findFirst({
    where: (v, { eq: eqOp }) => eqOp(v.id, videoId),
    columns: { organizationId: true },
  });
  return video?.organizationId ?? null;
}

/**
 * Process a video with full AI analysis pipeline using durable workflow execution.
 *
 * This workflow:
 * 1. Updates status to transcribing
 * 2. Transcribes the video using OpenAI Whisper
 * 3. Saves the transcript to the database
 * 4. Generates and uploads thumbnail to storage
 * 5. Updates status to diarizing (if enabled)
 * 6. Runs speaker diarization (if configured)
 * 7. Saves speaker data to the database
 * 8. Updates status to analyzing
 * 9. Runs AI analysis (summary, tags, action items, chapters, code snippets)
 * 10. Saves all AI results to the database
 * 11. Detects and saves key moments for clip extraction
 * 12. Extracts decisions for knowledge graph
 * 13. Saves extracted decisions to database
 * 14. Updates status to completed
 * 15. Sends completion notification
 *
 * Each step is checkpointed, so if the server restarts, processing resumes
 * from the last successful step.
 *
 * Note: Step calls are at top level (not inside try/catch) so the workflow
 * static analyzer can trace them for the debug UI.
 */
export async function processVideoWorkflow(input: VideoProcessingInput): Promise<VideoProcessingResult> {
  'use workflow';

  const { videoId, videoUrl, videoTitle, organizationId, skipDiarization, participantNames } = input;

  // Step 1: Update status to transcribing
  const statusResult = await updateProcessingStatus(videoId, 'transcribing').catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (statusResult && 'error' in statusResult) {
    return handleWorkflowFailure(videoId, statusResult.error);
  }

  // Step 1.5: Fetch vocabulary terms for transcription (if organization is known)
  let vocabularyTerms: string[] = [];
  if (organizationId) {
    vocabularyTerms = await getVocabularyTerms(organizationId);
  }

  // Step 2: Transcribe the video with vocabulary hints
  const transcribeResult = await transcribeVideo(videoUrl, {
    vocabularyTerms,
    participantNames,
  }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    isFatal: error instanceof FatalError,
  }));
  if ('error' in transcribeResult) {
    if (transcribeResult.isFatal) {
      await handleWorkflowFailure(videoId, transcribeResult.error);
      throw new FatalError(transcribeResult.error);
    }
    return handleWorkflowFailure(videoId, transcribeResult.error);
  }
  let transcription: TranscriptionResult = transcribeResult;

  // Step 2.5: Apply vocabulary corrections to transcript (post-processing)
  if (organizationId) {
    const corrected = await applyVocabularyCorrections(
      organizationId,
      transcription.transcript,
      transcription.segments as TranscriptSegment[],
    );
    transcription = {
      ...transcription,
      transcript: corrected.transcript,
      segments: corrected.segments,
    };
  }

  // Step 3: Save transcript and duration
  const saveTranscriptResult = await saveTranscript(
    videoId,
    transcription.transcript,
    transcription.segments,
    transcription.duration,
  ).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (saveTranscriptResult && 'error' in saveTranscriptResult) {
    return handleWorkflowFailure(videoId, saveTranscriptResult.error);
  }

  // Step 3.5: Generate and save thumbnail
  if (organizationId) {
    const thumbnailUrl = await generateAndUploadThumbnail(videoId, videoUrl, organizationId);
    if (thumbnailUrl) {
      await saveThumbnailUrl(videoId, thumbnailUrl);
    }
  }

  // Step 4: Speaker diarization (if enabled and configured)
  let diarization: DiarizationResult | null = null;
  if (!skipDiarization && organizationId) {
    // Update status to diarizing
    await updateProcessingStatus(videoId, 'diarizing');

    // Run speaker diarization
    diarization = await diarizeVideo(videoUrl);

    // Save speaker data if diarization succeeded
    if (diarization) {
      await saveSpeakerData(videoId, organizationId, diarization);
    }
  }

  // Step 5: Update status to analyzing
  const analyzeStatusResult = await updateProcessingStatus(videoId, 'analyzing').catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (analyzeStatusResult && 'error' in analyzeStatusResult) {
    return handleWorkflowFailure(videoId, analyzeStatusResult.error);
  }

  // Step 6: Run AI analysis
  const analysisResult = await analyzeWithAI(transcription.transcript, transcription.segments, videoTitle).catch(
    (error) => ({
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  if ('error' in analysisResult) {
    return handleWorkflowFailure(videoId, analysisResult.error);
  }
  const analysis: AIAnalysisResult = analysisResult;

  // Step 7: Save AI analysis results
  const saveAnalysisResult = await saveAIAnalysis(videoId, analysis).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (saveAnalysisResult && 'error' in saveAnalysisResult) {
    return handleWorkflowFailure(videoId, saveAnalysisResult.error);
  }

  // Step 8: Detect key moments for clip extraction
  const moments = await detectKeyMoments(transcription.transcript, transcription.segments, videoTitle);

  // Step 9: Save key moments
  if (organizationId && moments.length > 0) {
    await saveKeyMoments(videoId, organizationId, moments);
  }

  // Step 10: Extract decisions for knowledge graph
  const extractedDecisions = await extractDecisions(transcription.segments, videoTitle);

  // Log diagnostics to help debug decision extraction issues
  const DECISION_CONFIDENCE_THRESHOLD = 30;
  logDecisionDiagnostics(videoId, extractedDecisions, DECISION_CONFIDENCE_THRESHOLD);

  // Step 11: Save extracted decisions to database
  const effectiveOrgId = organizationId || (await getVideoOrganizationId(videoId));
  if (effectiveOrgId) {
    await saveDecisions(videoId, effectiveOrgId, extractedDecisions);
  }

  // Step 12: Update status to completed
  await updateProcessingStatus(videoId, 'completed');

  // Step 13: Send completion notification
  await sendCompletionNotification(videoId, 'completed');

  return {
    videoId,
    success: true,
  };
}
