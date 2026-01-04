/**
 * Embedding Service using Effect-TS
 *
 * Provides type-safe embedding generation using OpenAI's text-embedding-3-small model.
 * Embeddings are 1536-dimensional vectors used for semantic similarity search.
 */

import { gateway } from "@ai-sdk/gateway";
import { embed, embedMany } from "ai";
import { Context, Effect, Layer } from "effect";
import type { TranscriptSegment } from "@/lib/db/schema";
import { AIServiceError } from "../errors";

// =============================================================================
// Types
// =============================================================================

/**
 * A single chunk of text with metadata for embedding
 */
export interface TextChunk {
  readonly text: string;
  readonly chunkIndex: number;
  readonly timestampStart?: number;
  readonly timestampEnd?: number;
  readonly speakers?: readonly string[];
  readonly tokenCount?: number;
}

/**
 * Embedding result for a chunk
 */
export interface ChunkEmbedding {
  readonly chunk: TextChunk;
  readonly embedding: readonly number[];
}

/**
 * Configuration for chunking
 */
export interface ChunkConfig {
  readonly maxTokens?: number; // Default: 500
  readonly overlapTokens?: number; // Default: 50
}

export interface EmbeddingServiceInterface {
  /**
   * Generate an embedding for a single text
   */
  readonly generateEmbedding: (text: string) => Effect.Effect<readonly number[], AIServiceError>;

  /**
   * Generate embeddings for multiple texts in batch
   */
  readonly generateEmbeddings: (
    texts: readonly string[],
  ) => Effect.Effect<readonly (readonly number[])[], AIServiceError>;

  /**
   * Chunk a transcript into segments suitable for embedding
   */
  readonly chunkTranscript: (
    transcript: string,
    segments?: readonly TranscriptSegment[],
    config?: ChunkConfig,
  ) => Effect.Effect<readonly TextChunk[], never>;

  /**
   * Generate embeddings for transcript chunks
   */
  readonly embedTranscriptChunks: (
    chunks: readonly TextChunk[],
  ) => Effect.Effect<readonly ChunkEmbedding[], AIServiceError>;

  /**
   * Chunk and embed a full transcript in one operation
   */
  readonly processTranscript: (
    transcript: string,
    segments?: readonly TranscriptSegment[],
    config?: ChunkConfig,
  ) => Effect.Effect<readonly ChunkEmbedding[], AIServiceError>;
}

// =============================================================================
// Embedding Service Tag
// =============================================================================

export class Embedding extends Context.Tag("Embedding")<Embedding, EmbeddingServiceInterface>() {}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Estimate token count for a text string
 * Using a rough approximation of 4 characters per token for English text
 */
const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Split text into sentences (basic sentence boundary detection)
 */
const splitIntoSentences = (text: string): string[] => {
  // Split on sentence boundaries while keeping the delimiter
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
};

// =============================================================================
// Embedding Service Implementation
// =============================================================================

const makeEmbeddingService = Effect.gen(function* () {
  const embeddingModel = gateway.textEmbeddingModel("text-embedding-3-small");

  const generateEmbedding = (text: string): Effect.Effect<readonly number[], AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        const { embedding } = await embed({
          model: embeddingModel,
          value: text,
        });
        return embedding;
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate embedding",
          operation: "generateEmbedding",
          cause: error,
        }),
    });

  const generateEmbeddings = (
    texts: readonly string[],
  ): Effect.Effect<readonly (readonly number[])[], AIServiceError> =>
    Effect.tryPromise({
      try: async () => {
        if (texts.length === 0) {
          return [];
        }

        // Process in batches of 100 (OpenAI limit)
        const batchSize = 100;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const { embeddings } = await embedMany({
            model: embeddingModel,
            values: batch as string[],
          });
          allEmbeddings.push(...embeddings);
        }

        return allEmbeddings;
      },
      catch: (error) =>
        new AIServiceError({
          message: "Failed to generate embeddings batch",
          operation: "generateEmbeddings",
          cause: error,
        }),
    });

  const chunkTranscript = (
    transcript: string,
    segments?: readonly TranscriptSegment[],
    config?: ChunkConfig,
  ): Effect.Effect<readonly TextChunk[], never> =>
    Effect.sync(() => {
      const maxTokens = config?.maxTokens ?? 500;
      const overlapTokens = config?.overlapTokens ?? 50;
      const chunks: TextChunk[] = [];

      if (segments && segments.length > 0) {
        // Use transcript segments for more accurate chunking with timestamps
        let currentChunk: {
          texts: string[];
          startTime: number;
          endTime: number;
          speakers: Set<string>;
          tokenCount: number;
        } = {
          texts: [],
          startTime: segments[0].startTime,
          endTime: segments[0].endTime,
          speakers: new Set(),
          tokenCount: 0,
        };

        for (const segment of segments) {
          const segmentTokens = estimateTokenCount(segment.text);

          if (currentChunk.tokenCount + segmentTokens > maxTokens && currentChunk.texts.length > 0) {
            // Save current chunk
            chunks.push({
              text: currentChunk.texts.join(" "),
              chunkIndex: chunks.length,
              timestampStart: currentChunk.startTime,
              timestampEnd: currentChunk.endTime,
              speakers: Array.from(currentChunk.speakers),
              tokenCount: currentChunk.tokenCount,
            });

            // Start new chunk with overlap
            const overlapTexts: string[] = [];
            let overlapTokenCount = 0;
            for (let i = currentChunk.texts.length - 1; i >= 0 && overlapTokenCount < overlapTokens; i--) {
              const text = currentChunk.texts[i];
              const tokens = estimateTokenCount(text);
              if (overlapTokenCount + tokens <= overlapTokens) {
                overlapTexts.unshift(text);
                overlapTokenCount += tokens;
              } else {
                break;
              }
            }

            currentChunk = {
              texts: overlapTexts,
              startTime: segment.startTime,
              endTime: segment.endTime,
              speakers: new Set(),
              tokenCount: overlapTokenCount,
            };
          }

          currentChunk.texts.push(segment.text);
          currentChunk.endTime = segment.endTime;
          currentChunk.tokenCount += segmentTokens;
        }

        // Don't forget the last chunk
        if (currentChunk.texts.length > 0) {
          chunks.push({
            text: currentChunk.texts.join(" "),
            chunkIndex: chunks.length,
            timestampStart: currentChunk.startTime,
            timestampEnd: currentChunk.endTime,
            speakers: Array.from(currentChunk.speakers),
            tokenCount: currentChunk.tokenCount,
          });
        }
      } else {
        // Fallback to sentence-based chunking for plain text
        const sentences = splitIntoSentences(transcript);
        let currentChunk: { texts: string[]; tokenCount: number } = { texts: [], tokenCount: 0 };

        for (const sentence of sentences) {
          const sentenceTokens = estimateTokenCount(sentence);

          if (currentChunk.tokenCount + sentenceTokens > maxTokens && currentChunk.texts.length > 0) {
            // Save current chunk
            chunks.push({
              text: currentChunk.texts.join(" "),
              chunkIndex: chunks.length,
              tokenCount: currentChunk.tokenCount,
            });

            // Start new chunk with overlap
            const overlapTexts: string[] = [];
            let overlapTokenCount = 0;
            for (let i = currentChunk.texts.length - 1; i >= 0 && overlapTokenCount < overlapTokens; i--) {
              const text = currentChunk.texts[i];
              const tokens = estimateTokenCount(text);
              if (overlapTokenCount + tokens <= overlapTokens) {
                overlapTexts.unshift(text);
                overlapTokenCount += tokens;
              } else {
                break;
              }
            }

            currentChunk = {
              texts: overlapTexts,
              tokenCount: overlapTokenCount,
            };
          }

          currentChunk.texts.push(sentence);
          currentChunk.tokenCount += sentenceTokens;
        }

        // Don't forget the last chunk
        if (currentChunk.texts.length > 0) {
          chunks.push({
            text: currentChunk.texts.join(" "),
            chunkIndex: chunks.length,
            tokenCount: currentChunk.tokenCount,
          });
        }
      }

      return chunks;
    });

  const embedTranscriptChunks = (
    chunks: readonly TextChunk[],
  ): Effect.Effect<readonly ChunkEmbedding[], AIServiceError> =>
    Effect.gen(function* () {
      if (chunks.length === 0) {
        return [];
      }

      const texts = chunks.map((c) => c.text);
      const embeddings = yield* generateEmbeddings(texts);

      return chunks.map((chunk, i) => ({
        chunk,
        embedding: embeddings[i],
      }));
    });

  const processTranscript = (
    transcript: string,
    segments?: readonly TranscriptSegment[],
    config?: ChunkConfig,
  ): Effect.Effect<readonly ChunkEmbedding[], AIServiceError> =>
    Effect.gen(function* () {
      const chunks = yield* chunkTranscript(transcript, segments, config);
      return yield* embedTranscriptChunks(chunks);
    });

  return {
    generateEmbedding,
    generateEmbeddings,
    chunkTranscript,
    embedTranscriptChunks,
    processTranscript,
  } satisfies EmbeddingServiceInterface;
});

// =============================================================================
// Embedding Layer
// =============================================================================

export const EmbeddingLive = Layer.effect(Embedding, makeEmbeddingService);

// =============================================================================
// Embedding Helper Functions
// =============================================================================

/**
 * Generate an embedding for a single text
 */
export const generateEmbedding = (text: string): Effect.Effect<readonly number[], AIServiceError, Embedding> =>
  Effect.gen(function* () {
    const embedding = yield* Embedding;
    return yield* embedding.generateEmbedding(text);
  });

/**
 * Generate embeddings for multiple texts
 */
export const generateEmbeddings = (
  texts: readonly string[],
): Effect.Effect<readonly (readonly number[])[], AIServiceError, Embedding> =>
  Effect.gen(function* () {
    const embedding = yield* Embedding;
    return yield* embedding.generateEmbeddings(texts);
  });

/**
 * Chunk a transcript into segments
 */
export const chunkTranscript = (
  transcript: string,
  segments?: readonly TranscriptSegment[],
  config?: ChunkConfig,
): Effect.Effect<readonly TextChunk[], never, Embedding> =>
  Effect.gen(function* () {
    const embedding = yield* Embedding;
    return yield* embedding.chunkTranscript(transcript, segments, config);
  });

/**
 * Process a full transcript into embeddings
 */
export const processTranscript = (
  transcript: string,
  segments?: readonly TranscriptSegment[],
  config?: ChunkConfig,
): Effect.Effect<readonly ChunkEmbedding[], AIServiceError, Embedding> =>
  Effect.gen(function* () {
    const embedding = yield* Embedding;
    return yield* embedding.processTranscript(transcript, segments, config);
  });
