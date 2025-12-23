/**
 * k6 Load Test: Search Performance
 *
 * Tests full-text search under concurrent queries
 *
 * Run: k6 run --env BASE_URL=http://localhost:3000 k6/scenarios/search.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const searchDuration = new Trend('search_duration');
const searchSuccess = new Counter('search_success');
const searchEmpty = new Counter('search_empty');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  scenarios: {
    search_stress: {
      executor: 'constant-arrival-rate',
      rate: 100,            // 100 searches per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    'search_duration': ['p(95)<300', 'p(99)<500'],
    'http_req_failed': ['rate<0.01'],
    'errors': ['rate<0.01'],
  },
};

// Common search terms that might exist in notes
const SEARCH_TERMS = [
  'project',
  'meeting',
  'notes',
  'todo',
  'important',
  'deadline',
  'review',
  'update',
  'task',
  'complete',
  'idea',
  'plan',
  'follow up',
  'action item',
  'summary',
];

// Test users
const TEST_USERS = Array.from({ length: 12 }, (_, i) => ({
  username: `loadtest_${i + 1}`,
  password: 'LoadTest123!',
}));

// Token cache
const tokenCache = {};

function getToken(baseUrl, vu) {
  if (tokenCache[vu]) return tokenCache[vu];

  const user = TEST_USERS[vu % TEST_USERS.length];

  const res = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ username: user.username, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (res.status === 200) {
    tokenCache[vu] = JSON.parse(res.body).accessToken;
    return tokenCache[vu];
  }

  return null;
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const token = getToken(baseUrl, __VU);

  if (!token) {
    errorRate.add(1);
    sleep(1);
    return;
  }

  // Select random search term
  const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];

  const start = Date.now();

  const res = http.get(
    `${baseUrl}/api/search?q=${encodeURIComponent(term)}&limit=20`,
    {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: 'search' },
    }
  );

  searchDuration.add(Date.now() - start);

  const passed = check(res, {
    'search status is 200': (r) => r.status === 200,
    'search returns results array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.results) || Array.isArray(body.notes);
      } catch {
        return false;
      }
    },
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (passed) {
    searchSuccess.add(1);

    try {
      const body = JSON.parse(res.body);
      const results = body.results || body.notes || [];
      if (results.length === 0) {
        searchEmpty.add(1);
      }
    } catch {
      // Ignore parse errors for this metric
    }
  } else {
    errorRate.add(1);
  }
}

export function handleSummary(data) {
  const { metrics } = data;

  let output = '\n========== SEARCH LOAD TEST RESULTS ==========\n\n';

  output += `Search Success: ${metrics.search_success?.values?.count || 0}\n`;
  output += `Search Empty Results: ${metrics.search_empty?.values?.count || 0}\n`;
  output += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += `Search Duration (p50): ${metrics.search_duration?.values?.['p(50)']?.toFixed(2) || 'N/A'}ms\n`;
  output += `Search Duration (p95): ${metrics.search_duration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms\n`;
  output += `Search Duration (p99): ${metrics.search_duration?.values?.['p(99)']?.toFixed(2) || 'N/A'}ms\n\n`;

  output += '================================================\n';

  return {
    'stdout': output,
    'k6/results/search-summary.json': JSON.stringify(data, null, 2),
  };
}
