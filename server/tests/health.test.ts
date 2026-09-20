import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const testEnv = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/mini_shop',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough-123',
  CLIENT_ORIGIN: 'http://localhost:5173',
  LINE_CHANNEL_ID: 'test-channel',
};

const apps = new Set<ReturnType<typeof createApp>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

describe('GET /health', () => {
  it('returns a healthy service response', async () => {
    const app = createApp({
      env: testEnv,
      userRepository: {
        upsertFromLine: async () => ({ id: 'user-test', lineUserId: 'test', displayName: 'Test', role: 'customer' as const }),
        findByLineUserId: async () => null,
        listForAdmin: async () => [],
      },
      productRepository: {
        list: async () => [],
        findActiveByIds: async () => [],
        create: async (input) => ({ id: 'test', ...input, stockQuantity: input.stockQuantity ?? 0, reservedQuantity: 0, isActive: input.isActive ?? true, sortOrder: input.sortOrder ?? 0 }),
        update: async () => null,
        deactivate: async () => false,
      },
      orderRepository: {
        create: async () => { throw new Error('not used'); },
        listByUser: async () => [],
        cancel: async () => false,
        getByUser: async () => null,
        getByTransaction: async () => null,
        setPaymentPending: async () => { throw new Error('not used'); },
        markPaid: async () => null,
      },
    });
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
