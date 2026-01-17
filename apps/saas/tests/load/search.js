/**
 * Search Load Test
 *
 * Tests the search functionality under load:
 * - Quick search
 * - Full search with filters
 * - Search suggestions
 *
 * Run with: k6 run tests/load/search.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import { CONFIG, getAuthHeaders, LOAD_PROFILES } from './config.js';

// Custom metrics
const quickSearchDuration = new Trend('quick_search_duration', true);
const fullSearchDuration = new Trend('full_search_duration', true);
const suggestionsDuration = new Trend('suggestions_duration', true);
const searchSuccessRate = new Rate('search_success_rate');
const searchErrors = new Counter('search_errors');

// Sample search queries
const SEARCH_QUERIES = [
  'meeting',
  'demo',
  'product',
  'design',
  'engineering',
  'marketing',
  'sales',
  'roadmap',
  'sprint',
  'review',
  'onboarding',
  'tutorial',
  'how to',
  'api',
  'integration',
];

// Test configuration
const profile = __ENV.PROFILE || 'load';
export const options = LOAD_PROFILES[profile];

export function setup() {
  console.log(`Running search test with ${profile} profile`);
  console.log(`Target: ${CONFIG.baseUrl}`);

  const healthCheck = http.get(`${CONFIG.baseUrl}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Health check failed: ${healthCheck.status}`);
  }

  return { startTime: Date.now() };
}

export default function () {
  const baseUrl = CONFIG.baseUrl;
  const orgId = CONFIG.testOrgId;
  const headers = getAuthHeaders();

  // Pick a random search query
  const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

  // Step 1: Quick search (autocomplete)
  const quickStart = Date.now();
  const quickResponse = http.get(`${baseUrl}/api/search/quick?q=${encodeURIComponent(query)}&organizationId=${orgId}`, {
    headers,
    tags: { name: 'search_quick' },
  });
  quickSearchDuration.add(Date.now() - quickStart);

  const quickSuccess = check(quickResponse, {
    'quick search status is 200': (r) => r.status === 200,
    'quick search response time < 100ms': (r) => r.timings.duration < 100,
    'quick search returns results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });

  if (quickSuccess) {
    searchSuccessRate.add(1);
  } else {
    searchSuccessRate.add(0);
    searchErrors.add(1);
  }

  sleep(0.5);

  // Step 2: Full search
  const fullStart = Date.now();
  const fullResponse = http.get(`${baseUrl}/api/search?q=${encodeURIComponent(query)}&organizationId=${orgId}`, {
    headers,
    tags: { name: 'search_full' },
  });
  fullSearchDuration.add(Date.now() - fullStart);

  check(fullResponse, {
    'full search status is 200': (r) => r.status === 200,
    'full search response time < 300ms': (r) => r.timings.duration < 300,
    'full search returns videos': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });

  sleep(0.5);

  // Step 3: Search suggestions
  const suggestStart = Date.now();
  const suggestResponse = http.get(
    `${baseUrl}/api/search/suggestions?q=${encodeURIComponent(query.substring(0, 3))}&organizationId=${orgId}`,
    {
      headers,
      tags: { name: 'search_suggestions' },
    },
  );
  suggestionsDuration.add(Date.now() - suggestStart);

  check(suggestResponse, {
    'suggestions status is 200': (r) => r.status === 200,
    'suggestions response time < 50ms': (r) => r.timings.duration < 50,
  });

  // Think time - user reviewing results
  sleep(Math.random() * 3 + 1);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Search test completed in ${duration.toFixed(2)}s`);
}
