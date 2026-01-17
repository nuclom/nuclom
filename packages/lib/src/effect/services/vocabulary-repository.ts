/**
 * Vocabulary Repository Service
 *
 * Provides database operations for organization vocabulary and correction suggestions.
 * Used to improve transcription accuracy with custom terms, names, and jargon.
 */

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { Context, Data, Effect, Layer, Option } from 'effect';
import type {
  NewVocabularyCorrectionSuggestion,
  OrganizationVocabulary,
  VocabularyCorrectionSuggestion,
} from '../../db/schema';
import { organizationVocabulary, vocabularyCorrectionSuggestions } from '../../db/schema';
import { Database } from './database';

// =============================================================================
// Error Types
// =============================================================================

export class VocabularyRepositoryError extends Data.TaggedError('VocabularyRepositoryError')<{
  readonly message: string;
  readonly operation?: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Types
// =============================================================================

export type VocabularyCategory = 'product' | 'person' | 'technical' | 'acronym' | 'company';

export interface CreateVocabularyInput {
  readonly organizationId: string;
  readonly term: string;
  readonly variations?: readonly string[] | string[];
  readonly category: VocabularyCategory;
  readonly pronunciation?: string;
  readonly description?: string;
  readonly createdBy: string;
}

export interface UpdateVocabularyInput {
  readonly term?: string;
  readonly variations?: readonly string[] | string[];
  readonly category?: VocabularyCategory;
  readonly pronunciation?: string;
  readonly description?: string;
}

export interface VocabularyWithCreator extends OrganizationVocabulary {
  readonly createdByUser: {
    readonly id: string;
    readonly name: string;
    readonly image: string | null;
  } | null;
}

export interface CreateCorrectionSuggestionInput {
  readonly organizationId: string;
  readonly originalText: string;
  readonly correctedText: string;
}

export interface VocabularySearchResult {
  readonly term: string;
  readonly variations: string[];
  readonly category: VocabularyCategory;
  readonly matchScore: number; // 0-100
}

export interface VocabularyRepositoryService {
  // Vocabulary CRUD
  readonly createVocabulary: (
    input: CreateVocabularyInput,
  ) => Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError>;

  readonly getVocabulary: (
    id: string,
  ) => Effect.Effect<Option.Option<OrganizationVocabulary>, VocabularyRepositoryError>;

  readonly getOrganizationVocabulary: (
    organizationId: string,
    category?: VocabularyCategory,
  ) => Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError>;

  readonly getOrganizationVocabularyWithCreators: (
    organizationId: string,
  ) => Effect.Effect<VocabularyWithCreator[], VocabularyRepositoryError>;

  readonly updateVocabulary: (
    id: string,
    input: UpdateVocabularyInput,
  ) => Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError>;

  readonly deleteVocabulary: (id: string) => Effect.Effect<void, VocabularyRepositoryError>;

  readonly bulkCreateVocabulary: (
    inputs: CreateVocabularyInput[],
  ) => Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError>;

  // Vocabulary search and matching
  readonly searchVocabulary: (
    organizationId: string,
    searchTerm: string,
  ) => Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError>;

  readonly findMatchingVocabulary: (
    organizationId: string,
    text: string,
  ) => Effect.Effect<VocabularySearchResult[], VocabularyRepositoryError>;

  readonly getVocabularyTermsForPrompt: (
    organizationId: string,
    participantNames?: string[],
  ) => Effect.Effect<string[], VocabularyRepositoryError>;

  // Correction suggestions
  readonly createOrIncrementCorrectionSuggestion: (
    input: CreateCorrectionSuggestionInput,
  ) => Effect.Effect<VocabularyCorrectionSuggestion, VocabularyRepositoryError>;

  readonly getCorrectionSuggestions: (
    organizationId: string,
    status?: 'pending' | 'accepted' | 'dismissed',
  ) => Effect.Effect<VocabularyCorrectionSuggestion[], VocabularyRepositoryError>;

  readonly updateCorrectionSuggestionStatus: (
    id: string,
    status: 'accepted' | 'dismissed',
  ) => Effect.Effect<void, VocabularyRepositoryError>;

  readonly acceptCorrectionAsVocabulary: (
    suggestionId: string,
    category: VocabularyCategory,
    createdBy: string,
  ) => Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError>;
}

// =============================================================================
// Vocabulary Repository Tag
// =============================================================================

export class VocabularyRepository extends Context.Tag('VocabularyRepository')<
  VocabularyRepository,
  VocabularyRepositoryService
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeService = Effect.gen(function* () {
  const { db } = yield* Database;

  // ==========================================================================
  // Vocabulary CRUD
  // ==========================================================================

  const createVocabulary = (
    input: CreateVocabularyInput,
  ): Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const [vocab] = await db
          .insert(organizationVocabulary)
          .values({
            organizationId: input.organizationId,
            term: input.term,
            variations: input.variations ? [...input.variations] : [],
            category: input.category,
            pronunciation: input.pronunciation,
            description: input.description,
            createdBy: input.createdBy,
          })
          .returning();
        return vocab;
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to create vocabulary',
          operation: 'createVocabulary',
          cause: error,
        }),
    });

  const getVocabulary = (id: string): Effect.Effect<Option.Option<OrganizationVocabulary>, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const vocab = await db.query.organizationVocabulary.findFirst({
          where: eq(organizationVocabulary.id, id),
        });
        return vocab ? Option.some(vocab) : Option.none();
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to get vocabulary',
          operation: 'getVocabulary',
          cause: error,
        }),
    });

  const getOrganizationVocabulary = (
    organizationId: string,
    category?: VocabularyCategory,
  ): Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(organizationVocabulary.organizationId, organizationId)];
        if (category) {
          conditions.push(eq(organizationVocabulary.category, category));
        }
        return await db.query.organizationVocabulary.findMany({
          where: and(...conditions),
          orderBy: [desc(organizationVocabulary.createdAt)],
        });
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to get organization vocabulary',
          operation: 'getOrganizationVocabulary',
          cause: error,
        }),
    });

  const getOrganizationVocabularyWithCreators = (
    organizationId: string,
  ): Effect.Effect<VocabularyWithCreator[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const results = await db.query.organizationVocabulary.findMany({
          where: eq(organizationVocabulary.organizationId, organizationId),
          with: {
            createdByUser: {
              columns: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: [desc(organizationVocabulary.createdAt)],
        });
        return results as VocabularyWithCreator[];
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to get organization vocabulary with creators',
          operation: 'getOrganizationVocabularyWithCreators',
          cause: error,
        }),
    });

  const updateVocabulary = (
    id: string,
    input: UpdateVocabularyInput,
  ): Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const updateData: {
          term?: string;
          variations?: string[];
          category?: VocabularyCategory;
          pronunciation?: string;
          description?: string;
          updatedAt: Date;
        } = {
          ...input,
          variations: input.variations ? [...input.variations] : undefined,
          updatedAt: new Date(),
        };
        const [vocab] = await db
          .update(organizationVocabulary)
          .set(updateData)
          .where(eq(organizationVocabulary.id, id))
          .returning();
        return vocab;
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to update vocabulary',
          operation: 'updateVocabulary',
          cause: error,
        }),
    });

  const deleteVocabulary = (id: string): Effect.Effect<void, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(organizationVocabulary).where(eq(organizationVocabulary.id, id));
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to delete vocabulary',
          operation: 'deleteVocabulary',
          cause: error,
        }),
    });

  const bulkCreateVocabulary = (
    inputs: CreateVocabularyInput[],
  ): Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        if (inputs.length === 0) return [];
        const values = inputs.map((input) => ({
          organizationId: input.organizationId,
          term: input.term,
          variations: input.variations ? [...input.variations] : [],
          category: input.category,
          pronunciation: input.pronunciation,
          description: input.description,
          createdBy: input.createdBy,
        }));
        return await db.insert(organizationVocabulary).values(values).returning();
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to bulk create vocabulary',
          operation: 'bulkCreateVocabulary',
          cause: error,
        }),
    });

  // ==========================================================================
  // Vocabulary Search and Matching
  // ==========================================================================

  const searchVocabulary = (
    organizationId: string,
    searchTerm: string,
  ): Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const term = `%${searchTerm}%`;
        return await db.query.organizationVocabulary.findMany({
          where: and(
            eq(organizationVocabulary.organizationId, organizationId),
            or(
              ilike(organizationVocabulary.term, term),
              ilike(organizationVocabulary.description, term),
              sql`${organizationVocabulary.variations}::text ILIKE ${term}`,
            ),
          ),
          orderBy: [organizationVocabulary.term],
          limit: 50,
        });
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to search vocabulary',
          operation: 'searchVocabulary',
          cause: error,
        }),
    });

  const findMatchingVocabulary = (
    organizationId: string,
    text: string,
  ): Effect.Effect<VocabularySearchResult[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const vocabulary = await db.query.organizationVocabulary.findMany({
          where: eq(organizationVocabulary.organizationId, organizationId),
        });

        const results: VocabularySearchResult[] = [];
        const textLower = text.toLowerCase();

        for (const vocab of vocabulary) {
          let matchScore = 0;

          // Check exact term match
          if (textLower.includes(vocab.term.toLowerCase())) {
            matchScore = 100;
          } else {
            // Check variations
            for (const variation of vocab.variations) {
              if (textLower.includes(variation.toLowerCase())) {
                matchScore = Math.max(matchScore, 80);
                break;
              }
            }

            // Fuzzy matching using Levenshtein-like scoring for partial matches
            if (matchScore === 0) {
              const termWords = vocab.term.toLowerCase().split(/\s+/);
              const textWords = textLower.split(/\s+/);

              for (const termWord of termWords) {
                for (const textWord of textWords) {
                  const similarity = calculateSimilarity(termWord, textWord);
                  if (similarity > 0.7) {
                    matchScore = Math.max(matchScore, Math.floor(similarity * 60));
                  }
                }
              }
            }
          }

          if (matchScore > 0) {
            results.push({
              term: vocab.term,
              variations: vocab.variations,
              category: vocab.category,
              matchScore,
            });
          }
        }

        return results.sort((a, b) => b.matchScore - a.matchScore);
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to find matching vocabulary',
          operation: 'findMatchingVocabulary',
          cause: error,
        }),
    });

  const getVocabularyTermsForPrompt = (
    organizationId: string,
    participantNames?: string[],
  ): Effect.Effect<string[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const vocabulary = await db.query.organizationVocabulary.findMany({
          where: eq(organizationVocabulary.organizationId, organizationId),
          columns: { term: true },
        });

        const terms = vocabulary.map((v) => v.term);

        // Add participant names if provided
        if (participantNames && participantNames.length > 0) {
          terms.push(...participantNames);
        }

        // Deduplicate and return
        return [...new Set(terms)];
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to get vocabulary terms for prompt',
          operation: 'getVocabularyTermsForPrompt',
          cause: error,
        }),
    });

  // ==========================================================================
  // Correction Suggestions
  // ==========================================================================

  const createOrIncrementCorrectionSuggestion = (
    input: CreateCorrectionSuggestionInput,
  ): Effect.Effect<VocabularyCorrectionSuggestion, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        // Try to find existing suggestion
        const existing = await db.query.vocabularyCorrectionSuggestions.findFirst({
          where: and(
            eq(vocabularyCorrectionSuggestions.organizationId, input.organizationId),
            eq(vocabularyCorrectionSuggestions.originalText, input.originalText),
            eq(vocabularyCorrectionSuggestions.correctedText, input.correctedText),
          ),
        });

        if (existing) {
          // Increment occurrence count
          const [updated] = await db
            .update(vocabularyCorrectionSuggestions)
            .set({
              occurrenceCount: existing.occurrenceCount + 1,
              updatedAt: new Date(),
            })
            .where(eq(vocabularyCorrectionSuggestions.id, existing.id))
            .returning();
          return updated;
        }

        // Create new suggestion
        const [suggestion] = await db
          .insert(vocabularyCorrectionSuggestions)
          .values({
            organizationId: input.organizationId,
            originalText: input.originalText,
            correctedText: input.correctedText,
          } satisfies NewVocabularyCorrectionSuggestion)
          .returning();
        return suggestion;
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to create or increment correction suggestion',
          operation: 'createOrIncrementCorrectionSuggestion',
          cause: error,
        }),
    });

  const getCorrectionSuggestions = (
    organizationId: string,
    status?: 'pending' | 'accepted' | 'dismissed',
  ): Effect.Effect<VocabularyCorrectionSuggestion[], VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(vocabularyCorrectionSuggestions.organizationId, organizationId)];
        if (status) {
          conditions.push(eq(vocabularyCorrectionSuggestions.status, status));
        }
        return await db.query.vocabularyCorrectionSuggestions.findMany({
          where: and(...conditions),
          orderBy: [desc(vocabularyCorrectionSuggestions.occurrenceCount)],
        });
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to get correction suggestions',
          operation: 'getCorrectionSuggestions',
          cause: error,
        }),
    });

  const updateCorrectionSuggestionStatus = (
    id: string,
    status: 'accepted' | 'dismissed',
  ): Effect.Effect<void, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        await db
          .update(vocabularyCorrectionSuggestions)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(eq(vocabularyCorrectionSuggestions.id, id));
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to update correction suggestion status',
          operation: 'updateCorrectionSuggestionStatus',
          cause: error,
        }),
    });

  const acceptCorrectionAsVocabulary = (
    suggestionId: string,
    category: VocabularyCategory,
    createdBy: string,
  ): Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError> =>
    Effect.tryPromise({
      try: async () => {
        // Get the suggestion
        const suggestion = await db.query.vocabularyCorrectionSuggestions.findFirst({
          where: eq(vocabularyCorrectionSuggestions.id, suggestionId),
        });

        if (!suggestion) {
          throw new Error('Suggestion not found');
        }

        // Create vocabulary entry
        const [vocab] = await db
          .insert(organizationVocabulary)
          .values({
            organizationId: suggestion.organizationId,
            term: suggestion.correctedText,
            variations: [suggestion.originalText],
            category,
            createdBy,
          })
          .returning();

        // Mark suggestion as accepted
        await db
          .update(vocabularyCorrectionSuggestions)
          .set({
            status: 'accepted',
            updatedAt: new Date(),
          })
          .where(eq(vocabularyCorrectionSuggestions.id, suggestionId));

        return vocab;
      },
      catch: (error) =>
        new VocabularyRepositoryError({
          message: 'Failed to accept correction as vocabulary',
          operation: 'acceptCorrectionAsVocabulary',
          cause: error,
        }),
    });

  return {
    createVocabulary,
    getVocabulary,
    getOrganizationVocabulary,
    getOrganizationVocabularyWithCreators,
    updateVocabulary,
    deleteVocabulary,
    bulkCreateVocabulary,
    searchVocabulary,
    findMatchingVocabulary,
    getVocabularyTermsForPrompt,
    createOrIncrementCorrectionSuggestion,
    getCorrectionSuggestions,
    updateCorrectionSuggestionStatus,
    acceptCorrectionAsVocabulary,
  } satisfies VocabularyRepositoryService;
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate similarity between two strings (simple Levenshtein-based)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);

  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// =============================================================================
// Layer
// =============================================================================

export const VocabularyRepositoryLive = Layer.effect(VocabularyRepository, makeService);

// =============================================================================
// Helper Functions (exported)
// =============================================================================

export const createVocabulary = (
  input: CreateVocabularyInput,
): Effect.Effect<OrganizationVocabulary, VocabularyRepositoryError, VocabularyRepository> =>
  Effect.flatMap(VocabularyRepository, (repo) => repo.createVocabulary(input));

export const getOrganizationVocabulary = (
  organizationId: string,
  category?: VocabularyCategory,
): Effect.Effect<OrganizationVocabulary[], VocabularyRepositoryError, VocabularyRepository> =>
  Effect.flatMap(VocabularyRepository, (repo) => repo.getOrganizationVocabulary(organizationId, category));

export const getVocabularyTermsForPrompt = (
  organizationId: string,
  participantNames?: string[],
): Effect.Effect<string[], VocabularyRepositoryError, VocabularyRepository> =>
  Effect.flatMap(VocabularyRepository, (repo) => repo.getVocabularyTermsForPrompt(organizationId, participantNames));

export const findMatchingVocabulary = (
  organizationId: string,
  text: string,
): Effect.Effect<VocabularySearchResult[], VocabularyRepositoryError, VocabularyRepository> =>
  Effect.flatMap(VocabularyRepository, (repo) => repo.findMatchingVocabulary(organizationId, text));

/**
 * Apply vocabulary corrections to transcript text
 */
export function applyVocabularyCorrections(
  text: string,
  vocabulary: Array<{ term: string; variations: string[] }>,
): string {
  let result = text;

  for (const vocab of vocabulary) {
    for (const variation of vocab.variations) {
      // Case-insensitive replacement
      const regex = new RegExp(`\\b${escapeRegExp(variation)}\\b`, 'gi');
      result = result.replace(regex, vocab.term);
    }
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
