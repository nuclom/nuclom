/**
 * Video Processing Module
 *
 * This module handles the complete video processing pipeline.
 * Re-exports all public types and functions.
 */

// AI Analysis
export { analyzeWithAI, saveAIAnalysis } from './ai-analysis';
// Database helpers
export { getVideoOrganizationId, updateContentItemWithProcessedData, updateProcessingStatus } from './db-helpers';
// Decisions
export { extractDecisions, logDecisionDiagnostics, saveDecisions } from './decisions';
// Diarization
export { diarizeVideo, saveSpeakerData } from './diarization';
// Key moments
export { detectKeyMoments, saveKeyMoments } from './key-moments';
// Notifications
export { handleWorkflowFailure, sendCompletionNotification } from './notifications';
// Thumbnail
export { generateAndUploadThumbnail, saveThumbnailUrl } from './thumbnail';
// Title generation
export { generateVideoTitle, needsTitleGeneration, saveVideoTitle } from './title-generation';
// Transcription
export { saveTranscript, transcribeVideo } from './transcription';
// Types
export type {
  AIAnalysisResult,
  DetectedMoment,
  DiarizationResult,
  DiarizedSegment,
  ExtractedDecisionResult,
  SpeakerSummary,
  TranscriptionResult,
  VideoProcessingInput,
  VideoProcessingResult,
} from './types';
// Vocabulary helpers
export { applyVocabularyCorrections, escapeRegExp, getVocabularyTerms } from './vocabulary';
// Main workflow
export { processVideoWorkflow } from './workflow';
