/**
 * k6 Load Test: Note CRUD Operations
 *
 * Tests create, read, update, delete operations under load
 *
 * Run: k6 run --env BASE_URL=http://localhost:3000 k6/scenarios/note-crud.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Custom metrics
const createDuration = new Trend('note_create_duration');
const readDuration = new Trend('note_read_duration');
const updateDuration = new Trend('note_update_duration');
const deleteDuration = new Trend('note_delete_duration');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  scenarios: {
    crud_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 12 },   // Ramp to baseline
        { duration: '3m', target: 12 },   // Hold baseline
        { duration: '1m', target: 50 },   // Ramp to stress
        { duration: '5m', target: 50 },   // Hold stress
        { duration: '1m', target: 0 },    // Ramp down
      ],
    },
  },
  thresholds: {
    'note_create_duration': ['p(95)<400'],
    'note_read_duration': ['p(95)<200'],
    'note_update_duration': ['p(95)<400'],
    'note_delete_duration': ['p(95)<300'],
    'http_req_failed': ['rate<0.01'],
    'errors': ['rate<0.01'],
  },
};

// Test users
const TEST_USERS = Array.from({ length: 12 }, (_, i) => ({
  username: `loadtest_${i + 1}`,
  password: 'LoadTest123!',
}));

// Store tokens per VU
const tokens = {};

// Login and get token
function getToken(baseUrl, vu) {
  if (tokens[vu]) return tokens[vu];

  const user = TEST_USERS[vu % TEST_USERS.length];

  const loginRes = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({
      username: user.username,
      password: user.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    tokens[vu] = body.accessToken;
    return tokens[vu];
  }

  return null;
}

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const token = getToken(baseUrl, __VU);

  if (!token) {
    console.log(`VU ${__VU}: Failed to get token`);
    errorRate.add(1);
    sleep(5);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let noteId = null;

  // CREATE
  group('Create Note', () => {
    const start = Date.now();

    const res = http.post(
      `${baseUrl}/api/notes`,
      JSON.stringify({
        title: `Load Test Note ${__VU}-${__ITER}-${Date.now()}`,
        content: `<p>This is a test note created by VU ${__VU} in iteration ${__ITER}.</p>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>`,
      }),
      { headers, tags: { operation: 'create' } }
    );

    createDuration.add(Date.now() - start);

    const passed = check(res, {
      'create status is 201': (r) => r.status === 201,
      'create has note id': (r) => {
        try {
          const body = JSON.parse(r.body);
          noteId = body.note?.id;
          return noteId !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (!passed) errorRate.add(1);
  });

  sleep(0.5);

  // READ (if create succeeded)
  if (noteId) {
    group('Read Note', () => {
      const start = Date.now();

      const res = http.get(
        `${baseUrl}/api/notes/${noteId}`,
        { headers, tags: { operation: 'read' } }
      );

      readDuration.add(Date.now() - start);

      const passed = check(res, {
        'read status is 200': (r) => r.status === 200,
        'read has note content': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.note?.content !== undefined;
          } catch {
            return false;
          }
        },
      });

      if (!passed) errorRate.add(1);
    });

    sleep(0.5);

    // UPDATE
    group('Update Note', () => {
      const start = Date.now();

      const res = http.patch(
        `${baseUrl}/api/notes/${noteId}`,
        JSON.stringify({
          title: `Updated Load Test Note ${__VU}-${__ITER}`,
          content: `<p>This note has been updated at ${new Date().toISOString()}.</p>`,
        }),
        { headers, tags: { operation: 'update' } }
      );

      updateDuration.add(Date.now() - start);

      const passed = check(res, {
        'update status is 200': (r) => r.status === 200,
      });

      if (!passed) errorRate.add(1);
    });

    sleep(0.5);

    // DELETE (soft delete)
    group('Delete Note', () => {
      const start = Date.now();

      const res = http.del(
        `${baseUrl}/api/notes/${noteId}`,
        null,
        { headers, tags: { operation: 'delete' } }
      );

      deleteDuration.add(Date.now() - start);

      const passed = check(res, {
        'delete status is 200': (r) => r.status === 200,
      });

      if (!passed) errorRate.add(1);
    });
  }

  // List notes
  group('List Notes', () => {
    const res = http.get(
      `${baseUrl}/api/notes?limit=20`,
      { headers, tags: { operation: 'list' } }
    );

    check(res, {
      'list status is 200': (r) => r.status === 200,
      'list returns array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.notes);
        } catch {
          return false;
        }
      },
    });
  });

  sleep(Math.random() + 0.5);
}

// Cleanup: Could add teardown to permanently delete test notes
export function teardown(data) {
  console.log('CRUD test completed. Consider running cleanup to remove test notes.');
}
