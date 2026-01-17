/**
 * Comments Load Test
 *
 * Tests the comment functionality under load:
 * - Create comment
 * - Reply to comment
 * - React to comment
 * - Delete comment
 *
 * Run with: k6 run tests/load/comments.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { CONFIG, getAuthHeaders, LOAD_PROFILES } from './config.js';

// Custom metrics
const createCommentDuration = new Trend('create_comment_duration', true);
const replyDuration = new Trend('reply_duration', true);
const reactionDuration = new Trend('reaction_duration', true);
const commentSuccessRate = new Rate('comment_success_rate');
const commentErrors = new Counter('comment_errors');

// Sample comments
const SAMPLE_COMMENTS = [
  'Great explanation!',
  'Can you clarify the part at 2:30?',
  'This was really helpful, thanks!',
  'I have a question about this...',
  'Interesting approach to the problem',
  'Thanks for sharing this!',
  'Could you do a follow-up on this topic?',
  'Very clear presentation',
  'This saved me so much time',
  'Excellent demo!',
];

// Test configuration
const profile = __ENV.PROFILE || 'load';
export const options = LOAD_PROFILES[profile];

export function setup() {
  console.log(`Running comments test with ${profile} profile`);
  console.log(`Target: ${CONFIG.baseUrl}`);

  const healthCheck = http.get(`${CONFIG.baseUrl}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Health check failed: ${healthCheck.status}`);
  }

  return { startTime: Date.now() };
}

export default function () {
  const baseUrl = CONFIG.baseUrl;
  const videoId = CONFIG.testVideoId;
  const headers = getAuthHeaders();

  // Pick a random comment
  const commentText = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];

  // Step 1: Create a comment
  const createStart = Date.now();
  const createResponse = http.post(
    `${baseUrl}/api/videos/${videoId}/comments`,
    JSON.stringify({
      content: commentText,
      timestamp: Math.floor(Math.random() * 300), // Random timestamp 0-5min
    }),
    {
      headers,
      tags: { name: 'comment_create' },
    },
  );
  createCommentDuration.add(Date.now() - createStart);

  const createSuccess = check(createResponse, {
    'create comment status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'create comment response time < 300ms': (r) => r.timings.duration < 300,
    'create comment returns id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data?.id !== undefined || body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  let commentId = null;
  if (createSuccess) {
    commentSuccessRate.add(1);
    try {
      const body = JSON.parse(createResponse.body);
      commentId = body.data?.id || body.id;
    } catch {
      // ignore
    }
  } else {
    commentSuccessRate.add(0);
    commentErrors.add(1);
    console.error(`Create comment failed: ${createResponse.status}`);
  }

  sleep(1);

  // Step 2: React to comment (if we have an ID)
  if (commentId) {
    const reactionStart = Date.now();
    const reactionResponse = http.post(
      `${baseUrl}/api/comments/${commentId}/reactions`,
      JSON.stringify({ type: 'like' }),
      {
        headers,
        tags: { name: 'comment_reaction' },
      },
    );
    reactionDuration.add(Date.now() - reactionStart);

    check(reactionResponse, {
      'reaction status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'reaction response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(0.5);

    // Step 3: Reply to comment
    const replyStart = Date.now();
    const replyResponse = http.post(
      `${baseUrl}/api/videos/${videoId}/comments`,
      JSON.stringify({
        content: 'Thanks for your comment!',
        parentId: commentId,
      }),
      {
        headers,
        tags: { name: 'comment_reply' },
      },
    );
    replyDuration.add(Date.now() - replyStart);

    check(replyResponse, {
      'reply status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'reply response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(1);

    // Step 4: Delete the test comment (cleanup)
    http.del(`${baseUrl}/api/comments/${commentId}`, null, {
      headers,
      tags: { name: 'comment_delete' },
    });
  }

  // Think time
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Comments test completed in ${duration.toFixed(2)}s`);
}
