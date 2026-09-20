import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createAuthService, type LineTokenPayload } from '../src/auth.js';

const sessionSecret = 'test-session-secret-that-is-long-enough-123';
const testEnv = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/mini_shop',
  SESSION_SECRET: sessionSecret,
  CLIENT_ORIGIN: 'http://localhost:5173',
  LINE_CHANNEL_ID: 'channel-123',
};
const verifiedPayload: LineTokenPayload = {
  iss: 'https://access.line.me',
  sub: 'U123456789',
  aud: 'channel-123',
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
  name: 'คุณลูกค้า',
  picture: 'https://profile.line-scdn.net/avatar.jpg',
};

function makeService() {
  return createAuthService({
    channelId: 'channel-123',
    sessionSecret,
    fetchImpl: vi.fn(async () => new Response(JSON.stringify(verifiedPayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })),
  });
}

describe('LINE authentication', () => {
  afterEach(() => vi.restoreAllMocks());

  it('verifies the LINE ID token before creating a session', async () => {
    const service = makeService();

    const result = await service.authenticate('line-id-token');

    expect(result.user).toEqual({
      lineUserId: 'U123456789',
      displayName: 'คุณลูกค้า',
      pictureUrl: 'https://profile.line-scdn.net/avatar.jpg',
      role: 'customer',
    });
    await expect(service.readSession(result.sessionToken)).resolves.toMatchObject(result.user);
  });

  it('rejects an invalid LINE ID token', async () => {
    const service = createAuthService({
      channelId: 'channel-123',
      sessionSecret,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })),
    });

    await expect(service.authenticate('invalid-token')).rejects.toThrow('LINE ID token verification failed');
  });

  it('logs in, reads the current user, and logs out through HTTP routes', async () => {
    const app = createApp({ authService: makeService(), env: testEnv });
    await app.ready();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/line',
      payload: { idToken: 'line-id-token' },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeDefined();
    const sessionCookie = typeof cookie === 'string'
      ? cookie.split(';', 1)[0]
      : cookie?.[0]?.split(';', 1)[0];

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: sessionCookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: {
        lineUserId: 'U123456789',
        displayName: 'คุณลูกค้า',
        role: 'customer',
      },
    });

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: sessionCookie },
    });
    expect(logout.statusCode).toBe(204);

    await app.close();
  });
});
