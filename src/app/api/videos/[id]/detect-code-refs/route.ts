import { Cause, Effect, Exit, Layer } from 'effect';
import { type NextRequest, NextResponse } from 'next/server';
import { createFullLayer, mapErrorToApiResponse } from '@/lib/api-handler';
import type { CodeLinkType, DetectedCodeRef } from '@/lib/db/schema';
import { CodeLinksRepository, NotFoundError, VideoRepository } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { CodeReferenceDetector, CodeReferenceDetectorLive } from '@/lib/effect/services/code-reference-detector';

// =============================================================================
// POST /api/videos/[id]/detect-code-refs - Detect code references in video transcript
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Parse options from request body (optional) - do this before the Effect
  let suggestedRepo: string | undefined;
  let autoLink = false;
  try {
    const body = await request.json();
    suggestedRepo = body.suggestedRepo;
    autoLink = body.autoLink === true;
  } catch {
    // No body or invalid JSON - that's fine, use defaults
  }

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id: videoId } = yield* Effect.promise(() => params);

    // Get the video with its transcript
    const videoRepo = yield* VideoRepository;
    const video = yield* videoRepo.getVideo(videoId);

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Video not found',
          entity: 'Video',
          id: videoId,
        }),
      );
    }

    // Get the transcript - first try transcript segments, then fall back to raw transcript
    const transcriptSegments = (video as { transcriptSegments?: unknown }).transcriptSegments;
    const transcriptText = (video as { transcript?: string }).transcript;

    if (!transcriptSegments && !transcriptText) {
      return {
        success: true,
        data: {
          videoId,
          references: [],
          message: 'No transcript available for this video',
        },
      };
    }

    // Detect code references
    const detector = yield* CodeReferenceDetector;

    let references: DetectedCodeRef[] = [];
    if (transcriptSegments && Array.isArray(transcriptSegments)) {
      const result = yield* detector.detectInTranscript(transcriptSegments, {
        suggestedRepo,
        minConfidence: 0.6,
      });
      references = result.references;
    } else if (transcriptText) {
      references = yield* detector.detectInTranscriptText(transcriptText, {
        suggestedRepo,
        minConfidence: 0.6,
      });
    } else {
      references = [];
    }

    // If autoLink is true and suggestedRepo is provided, create code links for high-confidence detections
    let createdLinks: unknown[] = [];
    if (autoLink && suggestedRepo && references.length > 0) {
      const codeLinksRepo = yield* CodeLinksRepository;

      // First, delete any existing auto-detected links for this video
      yield* codeLinksRepo.deleteAutoDetectedLinks(videoId);

      // Filter to only high-confidence references that can be linked (PR, issue, commit, file)
      const linkableRefs = references.filter(
        (ref) => ref.confidence >= 0.75 && ['pr', 'issue', 'commit', 'file'].includes(ref.type) && ref.suggestedRepo,
      );

      if (linkableRefs.length > 0) {
        const linksToCreate = linkableRefs.map((ref) => {
          const repo = ref.suggestedRepo as string; // Already filtered for existence
          return {
            videoId,
            linkType: ref.type as CodeLinkType,
            githubRepo: repo,
            githubRef: ref.reference,
            githubUrl: generateGitHubUrl(repo, ref.type as CodeLinkType, ref.reference),
            context: `Auto-detected from transcript`,
            autoDetected: true,
            timestampStart: ref.timestamp,
            createdById: user.id,
          };
        });

        createdLinks = yield* codeLinksRepo.createCodeLinks(linksToCreate);
      }
    }

    return {
      success: true,
      data: {
        videoId,
        references,
        autoLinked: autoLink,
        createdLinksCount: createdLinks.length,
      },
    };
  });

  // Add CodeReferenceDetectorLive to the layer
  const FullLayerWithDetector = Layer.merge(createFullLayer(), CodeReferenceDetectorLive);
  const runnable = Effect.provide(effect, FullLayerWithDetector);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        return mapErrorToApiResponse(error.value);
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json(data, { status: 200 });
    },
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateGitHubUrl(repo: string, type: CodeLinkType, ref: string): string {
  const baseUrl = `https://github.com/${repo}`;

  switch (type) {
    case 'pr':
      return `${baseUrl}/pull/${ref}`;
    case 'issue':
      return `${baseUrl}/issues/${ref}`;
    case 'commit':
      return `${baseUrl}/commit/${ref}`;
    case 'file':
      return `${baseUrl}/blob/main/${ref}`;
    case 'directory':
      return `${baseUrl}/tree/main/${ref}`;
    default:
      return baseUrl;
  }
}
