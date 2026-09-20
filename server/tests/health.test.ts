import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

describe('GET /health', () => {
  it('returns a healthy service response', async () => {
    const app = createApp();
    apps.add(app);

    const response = await app.inject({ method: 'GET', url: '/health' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'mini-shop-api',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
