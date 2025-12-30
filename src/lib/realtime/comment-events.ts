/**
 * Comment Event Emitter for Real-time Updates
 *
 * Simple in-memory event emitter for comment events.
 * In production with multiple instances, use Redis Pub/Sub or similar.
 */

import type { CommentEvent } from "@/lib/effect/services/comment-repository";

type EventCallback = (event: CommentEvent) => void;

class CommentEventEmitter {
  private subscribers: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to comment events for a specific video
   */
  subscribe(videoId: string, callback: EventCallback): () => void {
    if (!this.subscribers.has(videoId)) {
      this.subscribers.set(videoId, new Set());
    }
    this.subscribers.get(videoId)?.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(videoId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(videoId);
        }
      }
    };
  }

  /**
   * Emit a comment event to all subscribers for a video
   */
  emit(videoId: string, event: CommentEvent): void {
    const callbacks = this.subscribers.get(videoId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(event);
        } catch (error) {
          console.error("[CommentEventEmitter] Error in subscriber callback:", error);
        }
      }
    }
  }

  /**
   * Get the number of subscribers for a video
   */
  getSubscriberCount(videoId: string): number {
    return this.subscribers.get(videoId)?.size ?? 0;
  }
}

// Global singleton for the event emitter
export const commentEventEmitter = new CommentEventEmitter();
