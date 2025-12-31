/**
 * Translation Service using Effect-TS
 *
 * Provides multi-language translation capabilities for transcripts and subtitles
 * using DeepL API for high-quality translations.
 */

import process from "node:process";
import { Context, Data, Effect, Layer, Schema } from "effect";
import type { TranscriptSegment } from "@/lib/db/schema";

// =============================================================================
// Error Types
// =============================================================================

export class TranslationNotConfiguredError extends Data.TaggedError("TranslationNotConfiguredError")<{
  readonly message: string;
}> {
  static readonly default = new TranslationNotConfiguredError({
    message: "DeepL API key not configured. Please set DEEPL_API_KEY environment variable.",
  });
}

export class TranslationApiError extends Data.TaggedError("TranslationApiError")<{
  readonly message: string;
  readonly statusCode?: number;
  readonly cause?: unknown;
}> {}

export class UnsupportedLanguageError extends Data.TaggedError("UnsupportedLanguageError")<{
  readonly message: string;
  readonly language: string;
}> {}

// =============================================================================
// Types & Schemas
// =============================================================================

export const SupportedLanguageSchema = Schema.Literal(
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "pl",
  "ru",
  "ja",
  "zh",
  "ko",
  "ar",
  "tr",
  "sv",
  "da",
  "fi",
  "nb",
  "el",
  "cs",
  "ro",
  "hu",
  "uk",
  "id",
  "vi",
  "th",
);

export type SupportedLanguage = Schema.Schema.Type<typeof SupportedLanguageSchema>;

export const LanguageInfoSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  nativeName: Schema.String,
  supportsFormality: Schema.Boolean,
});

export type LanguageInfo = Schema.Schema.Type<typeof LanguageInfoSchema>;

export const TranslationResultSchema = Schema.Struct({
  text: Schema.String,
  detectedSourceLanguage: Schema.optional(Schema.String),
});

export type TranslationResult = Schema.Schema.Type<typeof TranslationResultSchema>;

export const TranslatedTranscriptSchema = Schema.Struct({
  segments: Schema.Array(
    Schema.Struct({
      startTime: Schema.Number,
      endTime: Schema.Number,
      text: Schema.String,
      originalText: Schema.String,
      confidence: Schema.optional(Schema.Number),
    }),
  ),
  sourceLanguage: Schema.String,
  targetLanguage: Schema.String,
});

export type TranslatedTranscript = Schema.Schema.Type<typeof TranslatedTranscriptSchema>;

// =============================================================================
// Language Metadata
// =============================================================================

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageInfo> = {
  en: { code: "EN", name: "English", nativeName: "English", supportsFormality: false },
  es: { code: "ES", name: "Spanish", nativeName: "Español", supportsFormality: true },
  fr: { code: "FR", name: "French", nativeName: "Français", supportsFormality: true },
  de: { code: "DE", name: "German", nativeName: "Deutsch", supportsFormality: true },
  pt: { code: "PT", name: "Portuguese", nativeName: "Português", supportsFormality: true },
  it: { code: "IT", name: "Italian", nativeName: "Italiano", supportsFormality: true },
  nl: { code: "NL", name: "Dutch", nativeName: "Nederlands", supportsFormality: true },
  pl: { code: "PL", name: "Polish", nativeName: "Polski", supportsFormality: true },
  ru: { code: "RU", name: "Russian", nativeName: "Русский", supportsFormality: true },
  ja: { code: "JA", name: "Japanese", nativeName: "日本語", supportsFormality: false },
  zh: { code: "ZH", name: "Chinese", nativeName: "中文", supportsFormality: false },
  ko: { code: "KO", name: "Korean", nativeName: "한국어", supportsFormality: false },
  ar: { code: "AR", name: "Arabic", nativeName: "العربية", supportsFormality: false },
  tr: { code: "TR", name: "Turkish", nativeName: "Türkçe", supportsFormality: false },
  sv: { code: "SV", name: "Swedish", nativeName: "Svenska", supportsFormality: false },
  da: { code: "DA", name: "Danish", nativeName: "Dansk", supportsFormality: false },
  fi: { code: "FI", name: "Finnish", nativeName: "Suomi", supportsFormality: false },
  nb: { code: "NB", name: "Norwegian", nativeName: "Norsk", supportsFormality: false },
  el: { code: "EL", name: "Greek", nativeName: "Ελληνικά", supportsFormality: false },
  cs: { code: "CS", name: "Czech", nativeName: "Čeština", supportsFormality: false },
  ro: { code: "RO", name: "Romanian", nativeName: "Română", supportsFormality: false },
  hu: { code: "HU", name: "Hungarian", nativeName: "Magyar", supportsFormality: false },
  uk: { code: "UK", name: "Ukrainian", nativeName: "Українська", supportsFormality: false },
  id: { code: "ID", name: "Indonesian", nativeName: "Bahasa Indonesia", supportsFormality: false },
  vi: { code: "VI", name: "Vietnamese", nativeName: "Tiếng Việt", supportsFormality: false },
  th: { code: "TH", name: "Thai", nativeName: "ไทย", supportsFormality: false },
};

// =============================================================================
// Service Interface
// =============================================================================

export interface TranslationOptions {
  /** Source language (auto-detect if not provided) */
  sourceLanguage?: SupportedLanguage;
  /** Use formal/informal tone for supported languages */
  formality?: "default" | "more" | "less";
  /** Preserve formatting tags */
  preserveFormatting?: boolean;
  /** Split sentences for better translation */
  splitSentences?: boolean;
}

export interface TranslationServiceInterface {
  /**
   * Check if translation service is available
   */
  readonly isAvailable: () => boolean;

  /**
   * Translate a single text string
   */
  readonly translateText: (
    text: string,
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ) => Effect.Effect<TranslationResult, TranslationApiError | TranslationNotConfiguredError>;

  /**
   * Translate multiple texts in batch
   */
  readonly translateBatch: (
    texts: readonly string[],
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ) => Effect.Effect<TranslationResult[], TranslationApiError | TranslationNotConfiguredError>;

  /**
   * Translate transcript segments
   */
  readonly translateTranscript: (
    segments: readonly TranscriptSegment[],
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ) => Effect.Effect<TranslatedTranscript, TranslationApiError | TranslationNotConfiguredError>;

  /**
   * Get list of supported languages
   */
  readonly getSupportedLanguages: () => Effect.Effect<LanguageInfo[], never>;

  /**
   * Detect the language of a text
   */
  readonly detectLanguage: (
    text: string,
  ) => Effect.Effect<SupportedLanguage | null, TranslationApiError | TranslationNotConfiguredError>;
}

// =============================================================================
// Translation Service Tag
// =============================================================================

export class Translation extends Context.Tag("Translation")<Translation, TranslationServiceInterface>() {}

// =============================================================================
// DeepL API Types
// =============================================================================

interface DeepLTranslation {
  detected_source_language: string;
  text: string;
}

interface DeepLResponse {
  translations: DeepLTranslation[];
}

// =============================================================================
// Translation Service Implementation
// =============================================================================

const makeTranslationService = Effect.gen(function* () {
  const apiKey = process.env.DEEPL_API_KEY;
  const isConfigured = !!apiKey;

  // DeepL API endpoint (use free or pro based on key format)
  const apiUrl = apiKey?.endsWith(":fx") ? "https://api-free.deepl.com/v2" : "https://api.deepl.com/v2";

  const isAvailable = (): boolean => isConfigured;

  const callDeepLApi = <T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Effect.Effect<T, TranslationApiError | TranslationNotConfiguredError> =>
    Effect.gen(function* () {
      if (!apiKey) {
        return yield* Effect.fail(TranslationNotConfiguredError.default);
      }

      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch(`${apiUrl}${endpoint}`, {
            method: "POST",
            headers: {
              Authorization: `DeepL-Auth-Key ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`DeepL API error: ${res.status} - ${errorText}`);
          }

          return res.json() as Promise<T>;
        },
        catch: (error) =>
          new TranslationApiError({
            message: `Failed to call DeepL API: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
          }),
      });

      return response;
    });

  const translateText = (
    text: string,
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ): Effect.Effect<TranslationResult, TranslationApiError | TranslationNotConfiguredError> =>
    Effect.gen(function* () {
      const langInfo = SUPPORTED_LANGUAGES[targetLanguage];
      if (!langInfo) {
        return yield* Effect.fail(
          new TranslationApiError({
            message: `Unsupported target language: ${targetLanguage}`,
          }),
        );
      }

      const body: Record<string, unknown> = {
        text: [text],
        target_lang: langInfo.code,
      };

      if (options?.sourceLanguage) {
        body.source_lang = SUPPORTED_LANGUAGES[options.sourceLanguage]?.code;
      }

      if (options?.formality && langInfo.supportsFormality) {
        body.formality = options.formality;
      }

      if (options?.preserveFormatting !== undefined) {
        body.preserve_formatting = options.preserveFormatting;
      }

      if (options?.splitSentences !== undefined) {
        body.split_sentences = options.splitSentences ? "1" : "0";
      }

      const response = yield* callDeepLApi<DeepLResponse>("/translate", body);

      if (!response.translations || response.translations.length === 0) {
        return yield* Effect.fail(
          new TranslationApiError({
            message: "No translation returned from DeepL",
          }),
        );
      }

      return {
        text: response.translations[0].text,
        detectedSourceLanguage: response.translations[0].detected_source_language?.toLowerCase(),
      };
    });

  const translateBatch = (
    texts: readonly string[],
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ): Effect.Effect<TranslationResult[], TranslationApiError | TranslationNotConfiguredError> =>
    Effect.gen(function* () {
      if (texts.length === 0) {
        return [];
      }

      const langInfo = SUPPORTED_LANGUAGES[targetLanguage];
      if (!langInfo) {
        return yield* Effect.fail(
          new TranslationApiError({
            message: `Unsupported target language: ${targetLanguage}`,
          }),
        );
      }

      // DeepL supports batch translation
      const body: Record<string, unknown> = {
        text: texts,
        target_lang: langInfo.code,
      };

      if (options?.sourceLanguage) {
        body.source_lang = SUPPORTED_LANGUAGES[options.sourceLanguage]?.code;
      }

      if (options?.formality && langInfo.supportsFormality) {
        body.formality = options.formality;
      }

      const response = yield* callDeepLApi<DeepLResponse>("/translate", body);

      return response.translations.map((t) => ({
        text: t.text,
        detectedSourceLanguage: t.detected_source_language?.toLowerCase(),
      }));
    });

  const translateTranscript = (
    segments: readonly TranscriptSegment[],
    targetLanguage: SupportedLanguage,
    options?: TranslationOptions,
  ): Effect.Effect<TranslatedTranscript, TranslationApiError | TranslationNotConfiguredError> =>
    Effect.gen(function* () {
      if (segments.length === 0) {
        return {
          segments: [],
          sourceLanguage: options?.sourceLanguage || "en",
          targetLanguage,
        };
      }

      // Extract texts for batch translation
      const texts = segments.map((s) => s.text);

      // Translate all at once
      const translations = yield* translateBatch(texts, targetLanguage, options);

      // Combine with original segments
      const translatedSegments = segments.map((segment, index) => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        text: translations[index]?.text || segment.text,
        originalText: segment.text,
        confidence: segment.confidence,
      }));

      return {
        segments: translatedSegments,
        sourceLanguage: translations[0]?.detectedSourceLanguage || options?.sourceLanguage || "en",
        targetLanguage,
      };
    });

  const getSupportedLanguages = (): Effect.Effect<LanguageInfo[], never> =>
    Effect.succeed(Object.values(SUPPORTED_LANGUAGES));

  const detectLanguage = (
    text: string,
  ): Effect.Effect<SupportedLanguage | null, TranslationApiError | TranslationNotConfiguredError> =>
    Effect.gen(function* () {
      // Use a translation call to detect language (translate to EN)
      const result = yield* translateText(text.slice(0, 1000), "en");

      if (result.detectedSourceLanguage) {
        const langCode = result.detectedSourceLanguage.toLowerCase() as SupportedLanguage;
        if (langCode in SUPPORTED_LANGUAGES) {
          return langCode;
        }
      }

      return null;
    });

  return {
    isAvailable,
    translateText,
    translateBatch,
    translateTranscript,
    getSupportedLanguages,
    detectLanguage,
  } satisfies TranslationServiceInterface;
});

// =============================================================================
// Translation Layer
// =============================================================================

export const TranslationLive = Layer.effect(Translation, makeTranslationService);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Translate text using the Translation service
 */
export const translateText = (
  text: string,
  targetLanguage: SupportedLanguage,
  options?: TranslationOptions,
): Effect.Effect<TranslationResult, TranslationApiError | TranslationNotConfiguredError, Translation> =>
  Effect.gen(function* () {
    const service = yield* Translation;
    return yield* service.translateText(text, targetLanguage, options);
  });

/**
 * Translate transcript segments
 */
export const translateTranscript = (
  segments: readonly TranscriptSegment[],
  targetLanguage: SupportedLanguage,
  options?: TranslationOptions,
): Effect.Effect<TranslatedTranscript, TranslationApiError | TranslationNotConfiguredError, Translation> =>
  Effect.gen(function* () {
    const service = yield* Translation;
    return yield* service.translateTranscript(segments, targetLanguage, options);
  });

/**
 * Check if translation service is available
 */
export const isTranslationAvailable = (): Effect.Effect<boolean, never, Translation> =>
  Effect.gen(function* () {
    const service = yield* Translation;
    return service.isAvailable();
  });

/**
 * Get supported languages
 */
export const getSupportedLanguages = (): Effect.Effect<LanguageInfo[], never, Translation> =>
  Effect.gen(function* () {
    const service = yield* Translation;
    return yield* service.getSupportedLanguages();
  });
