/**
 * Subtitle Languages API Endpoint
 *
 * Lists available subtitle languages for a video.
 *
 * GET /api/videos/[id]/subtitles - List available subtitle languages
 */

import { Cause, Effect, Exit, Option } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, NotFoundError, Translation } from "@/lib/effect";
import { SUPPORTED_LANGUAGES } from "@/lib/effect/services/translation";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface SubtitleLanguage {
  code: string;
  name: string;
  nativeName: string;
  isOriginal: boolean;
  available: boolean;
  url: string;
}

interface SubtitleLanguagesResponse {
  videoId: string;
  hasTranscript: boolean;
  processingStatus: string;
  languages: SubtitleLanguage[];
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
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// =============================================================================
// GET /api/videos/[id]/subtitles - List Available Languages
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Fetch video with transcript
    const videoData = yield* Effect.tryPromise({
      try: () =>
        db.query.videos.findFirst({
          where: eq(videos.id, id),
          columns: {
            id: true,
            transcriptSegments: true,
            processingStatus: true,
          },
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getSubtitleLanguages",
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

    const hasTranscript = !!videoData.transcriptSegments && videoData.transcriptSegments.length > 0;

    // Check if translation service is available
    const translationService = yield* Translation;
    const translationAvailable = translationService.isAvailable();

    // Build language list
    const baseUrl = `/api/videos/${id}/subtitles`;
    const languages: SubtitleLanguage[] = Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
      code,
      name: info.name,
      nativeName: info.nativeName,
      isOriginal: code === "en",
      available: hasTranscript && (code === "en" || translationAvailable),
      url: `${baseUrl}/${code}.vtt`,
    }));

    // Sort: English first, then alphabetically
    languages.sort((a, b) => {
      if (a.isOriginal) return -1;
      if (b.isOriginal) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      videoId: id,
      hasTranscript,
      processingStatus: videoData.processingStatus,
      languages,
    } satisfies SubtitleLanguagesResponse;
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
    onSuccess: (data) => {
      const response: ApiResponse<SubtitleLanguagesResponse> = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}
