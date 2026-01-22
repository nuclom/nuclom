/**
 * AI Analysis
 *
 * Functions for analyzing video transcripts with AI to extract
 * summaries, tags, action items, and chapters.
 */

import type { TranscriptSegment } from '@nuclom/lib/db/schema';
import type { AIAnalysisResult } from './types';

/**
 * Analyze transcript with AI to extract summary, tags, action items, and chapters
 */
export async function analyzeWithAI(
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
  let actionItems: AIAnalysisResult['actionItems'] = [];
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

/**
 * Save AI analysis results to the database
 */
export async function saveAIAnalysis(videoId: string, analysis: AIAnalysisResult): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@nuclom/lib/db');
  const { videos, videoChapters } = await import('@nuclom/lib/db/schema');

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
