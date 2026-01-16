/**
 * Redis Client Configuration
 *
 * Uses Upstash Redis for:
 * - Rate limiting (distributed across instances)
 * - Session caching (future)
 * - Real-time features (future)
 */

import { Redis } from '@upstash/redis';
import { env } from '@/lib/env/server';

// =============================================================================
// Redis Client
// =============================================================================

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Get Redis client instance
 *
 * Returns null if Redis is not configured (falls back to in-memory)
 */
export function getRedisClient(): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

/**
 * Singleton Redis client instance
 */
let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisClient === null && isRedisConfigured()) {
    redisClient = getRedisClient();
  }
  return redisClient;
}
