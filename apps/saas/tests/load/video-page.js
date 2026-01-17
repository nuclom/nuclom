/**
 * Video Page Load Test
 *
 * Tests the video viewing experience under load:
 * - Video page load
 * - Video metadata fetch
 * - Comments loading
 * - Transcript fetch
 *
 * Run with: k6 run tests/load/video-page.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { CONFIG, getAuthHeaders, LOAD_PROFILES } from './config.js';

// Custom metrics
const videoLoadDuration = new Trend('video_load_duration', true);
const commentsLoadDuration = new Trend('comments_load_duration', true);
const transcriptLoadDuration = new Trend('transcript_load_duration', true);
const videoSuccessRate = new Rate('video_success_rate');
const videoErrors = new Counter('video_errors');

// Test configuration
const profile = __ENV.PROFILE || 'load';
export const options = LOAD_PROFILES[profile];

export function setup() {
  console.log(`Running video page test with ${profile} profile`);
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

  group('Video Page Load', () => {
    // Step 1: Fetch video metadata
    const videoStart = Date.now();
    const videoResponse = http.get(`${baseUrl}/api/videos/${videoId}`, {
      headers,
      tags: { name: 'video_metadata' },
    });
    videoLoadDuration.add(Date.now() - videoStart);

    const videoSuccess = check(videoResponse, {
      'video metadata status is 200': (r) => r.status === 200,
      'video has title': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data?.title !== undefined;
        } catch {
          return false;
        }
      },
      'video response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (videoSuccess) {
      videoSuccessRate.add(1);
    } else {
      videoSuccessRate.add(0);
      videoErrors.add(1);
      console.error(`Video load failed: ${videoResponse.status}`);
    }

    sleep(0.5);

    // Step 2: Fetch comments (in parallel with transcript in real app)
    const commentsStart = Date.now();
    const commentsResponse = http.get(`${baseUrl}/api/videos/${videoId}/comments`, {
      headers,
      tags: { name: 'video_comments' },
    });
    commentsLoadDuration.add(Date.now() - commentsStart);

    check(commentsResponse, {
      'comments status is 200': (r) => r.status === 200,
      'comments is array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data);
        } catch {
          return false;
        }
      },
      'comments response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.5);

    // Step 3: Fetch transcript
    const transcriptStart = Date.now();
    const transcriptResponse = http.get(`${baseUrl}/api/videos/${videoId}/transcript`, {
      headers,
      tags: { name: 'video_transcript' },
    });
    transcriptLoadDuration.add(Date.now() - transcriptStart);

    check(transcriptResponse, {
      'transcript status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'transcript response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  // Simulate watching video for a bit
  sleep(Math.random() * 5 + 2);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Video page test completed in ${duration.toFixed(2)}s`);
}
