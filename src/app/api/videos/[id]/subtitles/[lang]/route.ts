/**
 * Subtitle API Endpoint
 *
 * Serves WebVTT and SRT subtitle files for videos.
 * Supports multiple languages through translation.
 *
 * GET /api/videos/[id]/subtitles/[lang].vtt - Serve WebVTT subtitles
 * GET /api/videos/[id]/subtitles/[lang].srt - Serve SRT subtitles (for compatibility)
 */

import { Cause, Effect, Exit, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError, Translation, VideoRepository } from "@/lib/effect";
import { generateSRT, generateWebVTT, type WebVTTOptions } from "@/lib/subtitles";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/effect/services/translation";

// =============================================================================
// Types
// =============================================================================

interface SubtitleParams {
  id: string;
  lang: string; // e.g., "en.vtt", "es.vtt", "fr.srt"
}

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "TranslationNotConfiguredError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 503 });
      case "SubtitleError":
      case "UnsupportedLanguageError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// Parse Language and Format from Path
// =============================================================================

function parseLanguageAndFormat(lang: string): {
  language: SupportedLanguage;
  format: "vtt" | "srt";
} | null {
  // Remove file extension and parse
  const match = lang.match(/^([a-z]{2})(?:\.(vtt|srt))?$/i);
  if (!match) return null;

  const langCode = match[1].toLowerCase() as SupportedLanguage;
  const format = (match[2]?.toLowerCase() || "vtt") as "vtt" | "srt";

  // Validate language code
  if (!(langCode in SUPPORTED_LANGUAGES)) {
    return null;
  }

  return { language: langCode, format };
}

// =============================================================================
// GET /api/videos/[id]/subtitles/[lang] - Serve Subtitle File
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<SubtitleParams> },
) {
  const effect = Effect.gen(function* () {
    const { id, lang } = yield* Effect.promise(() => params);

    // Parse language and format
    const parsed = parseLanguageAndFormat(lang);
    if (!parsed) {
      return yield* Effect.fail(
        new NotFoundError({
          message: `Invalid language or format: ${lang}. Use format like "en.vtt" or "es.srt"`,
          entity: "Subtitle",
          id: lang,
        }),
      );
    }

    const { language, format } = parsed;

    // Fetch video with transcript
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          columns: {
            id: true,
            title: true,
            transcriptSegments: true,
            processingStatus: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getSubtitles",
          cause: error,
        }),
    });

    if (!videoData) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id,
        }),
      );
    }

    // Check if transcript exists
    if (!videoData.transcriptSegments || videoData.transcriptSegments.length === 0) {
      if (videoData.processingStatus === "transcribing" || videoData.processingStatus === "pending") {
        return yield* Effect.fail(
          new NotFoundError({
            message: "Transcript is still being generated. Please try again later.",
            entity: "Transcript",
            id,
          }),
        );
      }
      return yield* Effect.fail(
        new NotFoundError({
          message: "No transcript available for this video",
          entity: "Transcript",
          id,
        }),
      );
    }

    let segments = videoData.transcriptSegments;

    // Handle translation if not English
    if (language !== "en") {
      const translationService = yield* Translation;

      // Check if translation is available
      if (!translationService.isAvailable()) {
        return yield* Effect.fail(
          new NotFoundError({
            message: `Translation to ${SUPPORTED_LANGUAGES[language].name} is not available. Only English subtitles are currently supported.`,
            entity: "Translation",
            id: language,
          }),
        );
      }

      // Translate the segments
      const translated = yield* translationService.translateTranscript(segments, language);
      segments = translated.segments.map((seg) => ({
        startTime: seg.startTime,
        endTime: seg.endTime,
        text: seg.text,
        confidence: seg.confidence,
      }));
    }

    // Generate subtitle content
    const options: WebVTTOptions = {
      language,
      wrapLines: true,
      maxLineLength: 42,
    };

    const content = format === "vtt" ? generateWebVTT(segments, options) : generateSRT(segments);

    // Return response with appropriate content type
    const contentType = format === "vtt" ? "text/vtt" : "text/srt";
    const filename = `${videoData.title || "subtitles"}.${language}.${format}`;

    return {
      content,
      contentType,
      filename,
    };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: ({ content, contentType, filename }) => {
      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": `${contentType}; charset=utf-8`,
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
          "Access-Control-Allow-Origin": "*", // Allow CORS for video players
        },
      });
    },
  });
}

// =============================================================================
// OPTIONS - CORS Preflight
// =============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
