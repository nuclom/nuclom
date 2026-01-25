/**
 * English Subtitles Endpoint
 *
 * Serves WebVTT or SRT subtitle files for English captions.
 *
 * GET /api/videos/[id]/subtitles/en - Get English subtitles (WebVTT)
 * GET /api/videos/[id]/subtitles/en.vtt - Get English subtitles (WebVTT)
 * GET /api/videos/[id]/subtitles/en.srt - Get English subtitles (SRT)
 */

import { runApiEffect } from '@nuclom/lib/api-handler';
import { NotFoundError } from '@nuclom/lib/effect/errors';
import { VideoRepository } from '@nuclom/lib/effect/services/video-repository';
import { generateSRT, generateWebVTT } from '@nuclom/lib/subtitles';
import { Effect } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/videos/[id]/subtitles/en - Get English Subtitles
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Determine format from URL
    const url = new URL(request.url);
    const pathname = url.pathname;
    const format = pathname.endsWith('.srt') ? 'srt' : 'vtt';

    // Fetch video with transcript using repository
    const videoRepo = yield* VideoRepository;
    const videoData = yield* videoRepo.getVideo(id);

    if (!videoData.transcriptSegments || videoData.transcriptSegments.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'No transcript available for this video',
          entity: 'Transcript',
          id,
        }),
      );
    }

    // Generate subtitle content
    const content =
      format === 'srt'
        ? generateSRT(videoData.transcriptSegments)
        : generateWebVTT(videoData.transcriptSegments, { language: 'en' });

    const contentType = format === 'srt' ? 'text/plain; charset=utf-8' : 'text/vtt; charset=utf-8';
    const filename = `subtitles-en.${format}`;

    return { content, contentType, filename };
  });

  const exit = await runApiEffect(effect);

  if (exit._tag === 'Failure') {
    const error = exit.cause;
    if ('_tag' in error && error._tag === 'Fail') {
      const failure = error.error as { _tag: string; message: string };
      if (failure._tag === 'NotFoundError') {
        return NextResponse.json({ success: false, error: failure.message }, { status: 404 });
      }
    }
    return NextResponse.json({ success: false, error: 'Failed to generate subtitles' }, { status: 500 });
  }

  const { content, contentType, filename } = exit.value;

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
