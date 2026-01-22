/**
 * Video Processing Types
 *
 * Type definitions for the video processing workflow.
 */

import type { ActionItem, DecisionStatus, DecisionType, TranscriptSegment } from '@nuclom/lib/db/schema';

// =============================================================================
// Workflow Input/Output Types
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

// =============================================================================
// Transcription Types
// =============================================================================

export interface TranscriptionResult {
  transcript: string;
  segments: TranscriptSegment[];
  duration: number;
  language?: string;
}

// =============================================================================
// Diarization Types
// =============================================================================

export interface DiarizedSegment {
  speaker: string;
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
  confidence: number;
}

export interface SpeakerSummary {
  speaker: string;
  totalSpeakingTime: number; // milliseconds
  segmentCount: number;
  speakingPercentage: number;
}

export interface DiarizationResult {
  transcript: string;
  segments: DiarizedSegment[];
  speakers: SpeakerSummary[];
  duration: number;
  language?: string;
  speakerCount: number;
}

// =============================================================================
// AI Analysis Types
// =============================================================================

export interface AIAnalysisResult {
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

// =============================================================================
// Key Moments Types
// =============================================================================

export interface DetectedMoment {
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

// =============================================================================
// Decision Extraction Types
// =============================================================================

export interface ExtractedDecisionResult {
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
