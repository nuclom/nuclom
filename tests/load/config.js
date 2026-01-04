/**
 * Load Testing Configuration
 *
 * Shared configuration for k6 load tests.
 * Customize BASE_URL for your environment.
 */

// Environment configuration
export const CONFIG = {
  // Base URL - override with K6_BASE_URL environment variable
  baseUrl: __ENV.K6_BASE_URL || "https://staging.nuclom.com",

  // Test user credentials (use test accounts, never production!)
  testUser: {
    email: __ENV.K6_TEST_EMAIL || "load-test@example.com",
    password: __ENV.K6_TEST_PASSWORD || "test-password-123",
  },

  // API key for authenticated endpoints
  apiKey: __ENV.K6_API_KEY || "",

  // Test data IDs
  testVideoId: __ENV.K6_TEST_VIDEO_ID || "test-video-id",
  testOrgId: __ENV.K6_TEST_ORG_ID || "test-org-id",
};

// Common HTTP headers
export const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "k6-load-test/1.0",
};

// Get auth headers with API key
export function getAuthHeaders() {
  return {
    ...HEADERS,
    Authorization: `Bearer ${CONFIG.apiKey}`,
  };
}

// Standard thresholds for performance budgets
export const THRESHOLDS = {
  // 95th percentile response time < 200ms for API calls
  http_req_duration: ["p(95)<200", "p(99)<500"],
  // 99% of requests should succeed
  http_req_failed: ["rate<0.01"],
  // Check at least 95% pass rate
  checks: ["rate>0.95"],
};

// Load profile stages
export const LOAD_PROFILES = {
  // Smoke test - minimal load to verify functionality
  smoke: {
    stages: [
      { duration: "1m", target: 5 },
      { duration: "2m", target: 5 },
      { duration: "1m", target: 0 },
    ],
    thresholds: THRESHOLDS,
  },

  // Load test - moderate sustained load
  load: {
    stages: [
      { duration: "2m", target: 50 },
      { duration: "5m", target: 100 },
      { duration: "5m", target: 100 },
      { duration: "2m", target: 0 },
    ],
    thresholds: THRESHOLDS,
  },

  // Stress test - high load to find breaking point
  stress: {
    stages: [
      { duration: "2m", target: 100 },
      { duration: "5m", target: 500 },
      { duration: "5m", target: 1000 },
      { duration: "5m", target: 1000 },
      { duration: "2m", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<500", "p(99)<1000"],
      http_req_failed: ["rate<0.05"],
      checks: ["rate>0.90"],
    },
  },

  // Spike test - sudden traffic surge
  spike: {
    stages: [
      { duration: "1m", target: 100 },
      { duration: "30s", target: 1000 },
      { duration: "3m", target: 1000 },
      { duration: "30s", target: 100 },
      { duration: "2m", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<500"],
      http_req_failed: ["rate<0.10"],
      checks: ["rate>0.85"],
    },
  },

  // Soak test - extended duration for memory leaks
  soak: {
    stages: [
      { duration: "5m", target: 200 },
      { duration: "2h", target: 200 },
      { duration: "5m", target: 0 },
    ],
    thresholds: THRESHOLDS,
  },
};
