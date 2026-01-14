/**
 * Organization Vocabulary Schema
 *
 * Tables for organization-specific vocabulary to improve transcription accuracy:
 * - organizationVocabulary: Custom terms, names, and technical jargon
 * - vocabularyCorrectionSuggestions: AI-suggested vocabulary additions
 *
 * Vocabulary is used to:
 * 1. Bias Whisper transcription via initial_prompt
 * 2. Post-process transcripts to correct misheard terms
 * 3. Provide context for proper noun recognition
 */

import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, users } from './auth';
import { correctionSuggestionStatusEnum, vocabularyCategoryEnum } from './enums';

// =============================================================================
// Organization Vocabulary
// =============================================================================

export const organizationVocabulary = pgTable(
  'organization_vocabulary',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // The correct spelling/form of the term
    term: text('term').notNull(),
    // Common misheard variations (stored as JSON array for PostgreSQL compatibility)
    variations: text('variations').array().notNull().default([]),
    // Category for organization and filtering
    category: vocabularyCategoryEnum('category').notNull(),
    // Optional phonetic pronunciation hint
    pronunciation: text('pronunciation'),
    // Optional description/context for the term
    description: text('description'),
    // Who added this term
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('org_vocabulary_org_idx').on(table.organizationId),
    index('org_vocabulary_category_idx').on(table.organizationId, table.category),
    index('org_vocabulary_term_idx').on(table.organizationId, table.term),
    // Ensure unique terms per organization
    unique('org_vocabulary_org_term_unique').on(table.organizationId, table.term),
  ],
);

// =============================================================================
// Vocabulary Correction Suggestions
// =============================================================================

export const vocabularyCorrectionSuggestions = pgTable(
  'vocabulary_correction_suggestions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // The original text as transcribed
    originalText: text('original_text').notNull(),
    // The corrected/expected text
    correctedText: text('corrected_text').notNull(),
    // Number of times this correction was made
    occurrenceCount: integer('occurrence_count').default(1).notNull(),
    // Status of the suggestion
    status: correctionSuggestionStatusEnum('status').default('pending').notNull(),
    // When this suggestion was first detected
    suggestedAt: timestamp('suggested_at').defaultNow().notNull(),
    // When status was last updated
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('vocab_correction_org_idx').on(table.organizationId),
    index('vocab_correction_status_idx').on(table.organizationId, table.status),
    // Unique per org + original + corrected text pair
    unique('vocab_correction_org_text_unique').on(table.organizationId, table.originalText, table.correctedText),
  ],
);

// =============================================================================
// Type Exports
// =============================================================================

export type OrganizationVocabulary = typeof organizationVocabulary.$inferSelect;
export type NewOrganizationVocabulary = typeof organizationVocabulary.$inferInsert;
export type VocabularyCorrectionSuggestion = typeof vocabularyCorrectionSuggestions.$inferSelect;
export type NewVocabularyCorrectionSuggestion = typeof vocabularyCorrectionSuggestions.$inferInsert;

// =============================================================================
// Relations
// =============================================================================

export const organizationVocabularyRelations = relations(organizationVocabulary, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationVocabulary.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [organizationVocabulary.createdBy],
    references: [users.id],
  }),
}));

export const vocabularyCorrectionSuggestionsRelations = relations(vocabularyCorrectionSuggestions, ({ one }) => ({
  organization: one(organizations, {
    fields: [vocabularyCorrectionSuggestions.organizationId],
    references: [organizations.id],
  }),
}));
