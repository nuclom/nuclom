/**
 * Video Processing Workflow
 *
 * Main workflow function that orchestrates the video processing pipeline.
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

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import { FatalError } from 'workflow';
import { createWorkflowLogger } from '../workflow-logger';
import { analyzeWithAI, saveAIAnalysis } from './ai-analysis';
import { getVideoOrganizationId, updateContentItemWithProcessedData, updateProcessingStatus } from './db-helpers';
import { extractDecisions, logDecisionDiagnostics, saveDecisions } from './decisions';
import { diarizeVideo, saveSpeakerData } from './diarization';
import { detectKeyMoments, saveKeyMoments } from './key-moments';
import { handleWorkflowFailure, sendCompletionNotification } from './notifications';
import { generateAndUploadThumbnail, saveThumbnailUrl } from './thumbnail';
import { generateVideoTitle, needsTitleGeneration, saveVideoTitle } from './title-generation';
import { saveTranscript, transcribeVideo } from './transcription';
import type {
  AIAnalysisResult,
  DiarizationResult,
  TranscriptionResult,
  VideoProcessingInput,
  VideoProcessingResult,
} from './types';
import { applyVocabularyCorrections, getVocabularyTerms } from './vocabulary';

const log = createWorkflowLogger('video-processing');

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
    stack: error instanceof Error ? error.stack : undefined,
  }));
  if (statusResult && 'error' in statusResult) {
    return handleWorkflowFailure(videoId, statusResult.error, statusResult.stack);
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
    stack: error instanceof Error ? error.stack : undefined,
    isFatal: error instanceof FatalError,
  }));
  if ('error' in transcribeResult) {
    if (transcribeResult.isFatal) {
      await handleWorkflowFailure(videoId, transcribeResult.error, transcribeResult.stack);
      throw new FatalError(transcribeResult.error);
    }
    return handleWorkflowFailure(videoId, transcribeResult.error, transcribeResult.stack);
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
    stack: error instanceof Error ? error.stack : undefined,
  }));
  if (saveTranscriptResult && 'error' in saveTranscriptResult) {
    return handleWorkflowFailure(videoId, saveTranscriptResult.error, saveTranscriptResult.stack);
  }

  // Step 3.25: Generate AI title if not manually provided
  let effectiveVideoTitle = videoTitle;
  if (needsTitleGeneration(videoTitle)) {
    const generatedTitle = await generateVideoTitle(transcription.transcript);
    if (generatedTitle) {
      await saveVideoTitle(videoId, generatedTitle);
      effectiveVideoTitle = generatedTitle;
      log.info({ videoId, originalTitle: videoTitle, generatedTitle }, 'Generated AI title for video');
    }
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
    stack: error instanceof Error ? error.stack : undefined,
  }));
  if (analyzeStatusResult && 'error' in analyzeStatusResult) {
    return handleWorkflowFailure(videoId, analyzeStatusResult.error, analyzeStatusResult.stack);
  }

  // Step 6: Run AI analysis
  const analysisResult = await analyzeWithAI(
    transcription.transcript,
    transcription.segments,
    effectiveVideoTitle,
  ).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
  if ('error' in analysisResult) {
    return handleWorkflowFailure(videoId, analysisResult.error, analysisResult.stack);
  }
  const analysis: AIAnalysisResult = analysisResult;

  // Step 7: Save AI analysis results
  const saveAnalysisResult = await saveAIAnalysis(videoId, analysis).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
  if (saveAnalysisResult && 'error' in saveAnalysisResult) {
    return handleWorkflowFailure(videoId, saveAnalysisResult.error, saveAnalysisResult.stack);
  }

  // Step 8: Detect key moments for clip extraction
  const moments = await detectKeyMoments(transcription.transcript, transcription.segments, effectiveVideoTitle);

  // Step 9: Save key moments
  if (organizationId && moments.length > 0) {
    await saveKeyMoments(videoId, organizationId, moments);
  }

  // Step 10: Extract decisions for knowledge graph
  const extractedDecisions = await extractDecisions(transcription.segments, effectiveVideoTitle);

  // Log diagnostics to help debug decision extraction issues
  const DECISION_CONFIDENCE_THRESHOLD = 30;
  logDecisionDiagnostics(videoId, extractedDecisions, DECISION_CONFIDENCE_THRESHOLD);

  // Step 11: Save extracted decisions to database
  const effectiveOrgId = organizationId || (await getVideoOrganizationId(videoId));
  if (effectiveOrgId) {
    await saveDecisions(videoId, effectiveOrgId, extractedDecisions);
  }

  // Step 12: Update content_item with processed data for unified knowledge base
  const effectiveOrgIdForContent = organizationId || (await getVideoOrganizationId(videoId));
  if (effectiveOrgIdForContent) {
    await updateContentItemWithProcessedData(videoId, effectiveOrgIdForContent, {
      transcript: transcription.transcript,
      summary: analysis.summary,
      tags: analysis.tags,
    });
  }

  // Step 13: Update status to completed
  await updateProcessingStatus(videoId, 'completed');

  // Step 14: Send completion notification
  await sendCompletionNotification(videoId, 'completed');

  return {
    videoId,
    success: true,
  };
}
