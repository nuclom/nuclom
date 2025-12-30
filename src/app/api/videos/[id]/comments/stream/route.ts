import { type NextRequest } from "next/server";
import { commentEventEmitter } from "@/lib/realtime/comment-events";
import type { CommentEvent } from "@/lib/effect/services/comment-repository";

// =============================================================================
// GET /api/videos/[id]/comments/stream - SSE endpoint for real-time comments
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: videoId } = await params;

  // Create a TransformStream for SSE
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ videoId })}\n\n`));

      // Send periodic heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Stream closed, clean up
          clearInterval(heartbeat);
        }
      }, 30000);

      // Subscribe to comment events
      unsubscribe = commentEventEmitter.subscribe(videoId, (event: CommentEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`event: comment\ndata: ${data}\n\n`));
        } catch {
          // Stream closed
        }
      });

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        if (unsubscribe) {
          unsubscribe();
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Disable body parsing for SSE
export const dynamic = "force-dynamic";
