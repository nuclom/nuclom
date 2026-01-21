import { createPublicLayer } from '@nuclom/lib/api-handler';
import { videoViews } from '@nuclom/lib/db/schema';
import { VideoRepository, VideoShareLinksRepository } from '@nuclom/lib/effect';
import { Database } from '@nuclom/lib/effect/services/database';
import { logger } from '@nuclom/lib/logger';
import { Effect, Option } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// POST /api/embed/[id]/view - Track embed video view
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();

  const { id } = await params;
  const PublicLayer = createPublicLayer();

  try {
    const { db, video } = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const database = yield* Database;
          const shareLinkRepo = yield* VideoShareLinksRepository;
          const videoRepo = yield* VideoRepository;

          const shareLinkOption = yield* shareLinkRepo.getShareLinkOption(id);
          let videoId = id;

          if (Option.isSome(shareLinkOption)) {
            videoId = shareLinkOption.value.videoId;
            yield* shareLinkRepo.incrementShareLinkView(id);
          }

          const resolvedVideo = yield* videoRepo.getVideo(videoId);
          return { db: database.db, video: resolvedVideo };
        }),
        PublicLayer,
      ),
    );

    // Generate a session ID from request fingerprint
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const sessionId = Buffer.from(`${ip}:${userAgent}`).toString('base64').slice(0, 64);
    const referrer = request.headers.get('referer') || null;

    // Record the view (upsert to handle duplicate sessions)
    await db
      .insert(videoViews)
      .values({
        videoId: video.id,
        organizationId: video.organizationId,
        sessionId,
        source: 'embed',
        referrer,
        userAgent,
      })
      .onConflictDoUpdate({
        target: [videoViews.sessionId, videoViews.videoId],
        set: {
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.json({ success: true });

    // CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      '_tag' in error &&
      (error as { _tag?: string })._tag === 'NotFoundError'
    ) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    logger.error('Embed view tracking error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
