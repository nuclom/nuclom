/**
 * Authentication Flow Load Test
 *
 * Tests the authentication endpoints under load:
 * - Sign in
 * - Session validation
 * - Sign out
 *
 * Run with: k6 run tests/load/auth-flow.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { CONFIG, HEADERS, LOAD_PROFILES } from "./config.js";

// Custom metrics
const loginDuration = new Trend("login_duration", true);
const loginSuccessRate = new Rate("login_success_rate");
const sessionValidationDuration = new Trend("session_validation_duration", true);
const logoutDuration = new Trend("logout_duration", true);
const authErrors = new Counter("auth_errors");

// Test configuration
const profile = __ENV.PROFILE || "load";
export const options = LOAD_PROFILES[profile];

// Test setup - runs once before the test
export function setup() {
  console.log(`Running auth flow test with ${profile} profile`);
  console.log(`Target: ${CONFIG.baseUrl}`);

  // Verify the target is reachable
  const healthCheck = http.get(`${CONFIG.baseUrl}/api/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Health check failed: ${healthCheck.status}`);
  }

  return { startTime: Date.now() };
}

// Main test function
export default function () {
  const baseUrl = CONFIG.baseUrl;

  // Step 1: Sign In
  const loginPayload = JSON.stringify({
    email: CONFIG.testUser.email,
    password: CONFIG.testUser.password,
  });

  const loginStart = Date.now();
  const loginResponse = http.post(`${baseUrl}/api/auth/sign-in/email`, loginPayload, {
    headers: HEADERS,
    tags: { name: "auth_signin" },
  });
  loginDuration.add(Date.now() - loginStart);

  const loginSuccess = check(loginResponse, {
    "login status is 200": (r) => r.status === 200,
    "login returns session": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.session !== undefined || body.user !== undefined;
      } catch {
        return false;
      }
    },
    "login response time < 500ms": (r) => r.timings.duration < 500,
  });

  if (loginSuccess) {
    loginSuccessRate.add(1);
  } else {
    loginSuccessRate.add(0);
    authErrors.add(1);
    console.error(`Login failed: ${loginResponse.status} - ${loginResponse.body}`);
    return;
  }

  // Extract session cookie
  const cookies = loginResponse.cookies;
  const sessionCookie = cookies["better-auth.session_token"]
    ? cookies["better-auth.session_token"][0].value
    : null;

  sleep(1); // Think time between actions

  // Step 2: Validate Session
  if (sessionCookie) {
    const sessionStart = Date.now();
    const sessionResponse = http.get(`${baseUrl}/api/auth/get-session`, {
      headers: {
        ...HEADERS,
        Cookie: `better-auth.session_token=${sessionCookie}`,
      },
      tags: { name: "auth_session" },
    });
    sessionValidationDuration.add(Date.now() - sessionStart);

    check(sessionResponse, {
      "session validation status is 200": (r) => r.status === 200,
      "session returns user": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.user !== undefined;
        } catch {
          return false;
        }
      },
      "session response time < 100ms": (r) => r.timings.duration < 100,
    });
  }

  sleep(2); // Simulate user activity

  // Step 3: Sign Out
  if (sessionCookie) {
    const logoutStart = Date.now();
    const logoutResponse = http.post(
      `${baseUrl}/api/auth/sign-out`,
      null,
      {
        headers: {
          ...HEADERS,
          Cookie: `better-auth.session_token=${sessionCookie}`,
        },
        tags: { name: "auth_signout" },
      },
    );
    logoutDuration.add(Date.now() - logoutStart);

    check(logoutResponse, {
      "logout status is 200": (r) => r.status === 200,
      "logout response time < 200ms": (r) => r.timings.duration < 200,
    });
  }

  sleep(1); // Think time before next iteration
}

// Test teardown - runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Test completed in ${duration.toFixed(2)}s`);
}
