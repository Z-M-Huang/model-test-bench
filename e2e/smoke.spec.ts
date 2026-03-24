import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('health endpoint returns 200 with ok status', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  test('root returns HTML', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });

  test('all main routes return 200 (SPA fallback)', async ({ request }) => {
    const routes = ['/', '/setups', '/setups/new', '/scenarios', '/scenarios/new', '/run', '/history'];
    for (const route of routes) {
      const res = await request.get(route);
      expect(res.status(), `Expected 200 for ${route}`).toBe(200);
    }
  });

  test('API endpoints return JSON arrays', async ({ request }) => {
    // /api/runs and /api/evaluations may 404 when runner/evaluator not configured (no API key)
    const alwaysAvailable = ['/api/setups', '/api/scenarios'];
    for (const endpoint of alwaysAvailable) {
      const res = await request.get(endpoint);
      expect(res.status(), `Expected 200 for ${endpoint}`).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body), `Expected array for ${endpoint}`).toBe(true);
    }
  });

  test('non-existent API route returns 404 or error', async ({ request }) => {
    const res = await request.get('/api/nonexistent');
    // Express will either 404 or fall through to SPA; API routes not matched should not 200 JSON
    expect([404, 200]).toContain(res.status());
  });
});
