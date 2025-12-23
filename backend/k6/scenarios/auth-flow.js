/**
 * k6 Load Test: Authentication Flow
 *
 * Tests login/logout under concurrent load and validates rate limiting
 *
 * Run: k6 run --env BASE_URL=http://localhost:3000 k6/scenarios/auth-flow.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginSuccess = new Counter('login_success');
const loginFailure = new Counter('login_failure');
const rateLimitHits = new Counter('rate_limit_hits');
const loginDuration = new Trend('login_duration');
const logoutDuration = new Trend('logout_duration');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  scenarios: {
    // Baseline: Target homelab usage (12 users)
    auth_baseline: {
      executor: 'constant-vus',
      vus: 12,
      duration: '2m',
      tags: { tier: 'baseline' },
    },
    // Stress: 4x safety margin (50 users)
    auth_stress: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      startTime: '2m30s', // Start after baseline + cooldown
      tags: { tier: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    login_duration: ['p(95)<300'],
    logout_duration: ['p(95)<200'],
    errors: ['rate<0.01'],
  },
};

// Test users (created by seed script)
const TEST_USERS = Array.from({ length: 12 }, (_, i) => ({
  username: `loadtest_${i + 1}`,
  password: 'LoadTest123!',
}));

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const user = TEST_USERS[__VU % TEST_USERS.length];

  group('Login Flow', () => {
    const loginStart = Date.now();

    const loginRes = http.post(
      `${baseUrl}/api/auth/login`,
      JSON.stringify({
        username: user.username,
        password: user.password,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'login' },
      }
    );

    loginDuration.add(Date.now() - loginStart);

    const loginPassed = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login has access token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.accessToken !== undefined;
        } catch {
          return false;
        }
      },
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (loginPassed) {
      loginSuccess.add(1);

      const body = JSON.parse(loginRes.body);
      const token = body.accessToken;

      // Simulate user session (1-3 seconds of activity)
      sleep(Math.random() * 2 + 1);

      // Make a few API calls during session
      group('Session Activity', () => {
        // Get current user
        const meRes = http.get(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          tags: { name: 'get_me' },
        });

        check(meRes, {
          'get me status is 200': (r) => r.status === 200,
        });

        // List notes
        const notesRes = http.get(`${baseUrl}/api/notes?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
          tags: { name: 'list_notes' },
        });

        check(notesRes, {
          'list notes status is 200': (r) => r.status === 200,
        });
      });

      sleep(Math.random() + 0.5);

      // Logout
      group('Logout', () => {
        const logoutStart = Date.now();

        const logoutRes = http.post(
          `${baseUrl}/api/auth/logout`,
          null,
          {
            headers: { Authorization: `Bearer ${token}` },
            tags: { name: 'logout' },
          }
        );

        logoutDuration.add(Date.now() - logoutStart);

        check(logoutRes, {
          'logout status is 200 or 204': (r) => r.status === 200 || r.status === 204,
          'logout response time < 200ms': (r) => r.timings.duration < 200,
        });
      });
    } else {
      loginFailure.add(1);
      errorRate.add(1);

      // Check for rate limiting
      if (loginRes.status === 429) {
        rateLimitHits.add(1);
        console.log(`VU ${__VU}: Rate limited`);
      }
    }
  });

  // Cool down between iterations
  sleep(Math.random() * 2 + 1);
}

// Summary output
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'k6/results/auth-flow-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const { metrics } = data;

  let output = '\n========== AUTH FLOW LOAD TEST RESULTS ==========\n\n';

  output += `Login Success: ${metrics.login_success?.values?.count || 0}\n`;
  output += `Login Failure: ${metrics.login_failure?.values?.count || 0}\n`;
  output += `Rate Limit Hits: ${metrics.rate_limit_hits?.values?.count || 0}\n`;
  output += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += `Login Duration (p95): ${metrics.login_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  output += `Logout Duration (p95): ${metrics.logout_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  output += `HTTP Duration (p95): ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n\n`;

  output += '==================================================\n';

  return output;
}
