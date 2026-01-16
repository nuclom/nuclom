import { gateway } from '@ai-sdk/gateway';
import { generateText, streamText } from 'ai';
import { logger } from '@/lib/logger';

// AI service for video analysis and summaries
export class AIService {
  private model = gateway('xai/grok-3');

  async generateVideoSummary(transcript: string): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.model,
        prompt: `Please analyze this video transcript and provide a concise summary with key points and action items:

${transcript}

Please format the response as:
## Summary
[Brief overview]

## Key Points
- [Point 1]
- [Point 2]
- [Point 3]

## Action Items
- [Action 1]
- [Action 2]`,
      });

      return text;
    } catch (error) {
      throw new Error(`Failed to generate video summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateVideoTags(title: string, description?: string): Promise<string[]> {
    try {
      const { text } = await generateText({
        model: this.model,
        prompt: `Based on this video title and description, generate 5-8 relevant tags:

Title: ${title}
Description: ${description || 'N/A'}

Return only the tags as a comma-separated list.`,
      });

      return text.split(',').map((tag) => tag.trim());
    } catch (error) {
      logger.warn('Failed to generate video tags', { error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  async extractActionItems(transcript: string): Promise<string[]> {
    try {
      const { text } = await generateText({
        model: this.model,
        prompt: `Analyze this transcript and extract any action items, tasks, or to-dos mentioned:

${transcript}

Return each action item on a new line, or "None" if no action items are found.`,
      });

      const items = text.split('\n').filter((item) => item.trim() && !item.includes('None'));
      return items.map((item) => item.replace(/^[-*]\s*/, '').trim());
    } catch (error) {
      logger.warn('Failed to extract action items', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // Streaming API for real-time analysis
  createSummaryStream(transcript: string) {
    return streamText({
      model: this.model,
      prompt: `Analyze this video transcript and provide insights in real-time:

${transcript}`,
    });
  }
}

export const aiService = new AIService();
