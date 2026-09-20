import { describe, expect, it, vi } from 'vitest';
import { createAuthService, type LineTokenPayload } from '../src/auth.js';
import type { UserRepository } from '../src/users/repository.js';

const payload: LineTokenPayload = {
  iss: 'https://access.line.me',
  sub: 'U-repository-user',
  aud: 'channel-123',
  exp: Math.floor(Date.now() / 1000) + 300,
  iat: Math.floor(Date.now() / 1000),
  name: 'Repository User',
};

describe('LINE user repository integration', () => {
  it('upserts the verified LINE identity before creating a session', async () => {
    const repository: UserRepository = {
      upsertFromLine: vi.fn(async (input) => ({
        id: 'user-1',
        lineUserId: input.lineUserId,
        displayName: input.displayName,
        role: 'customer' as const,
      })),
      findByLineUserId: vi.fn(async () => null),
      listForAdmin: vi.fn(async () => []),
    };
    const service = createAuthService({
      channelId: 'channel-123',
      sessionSecret: 'test-session-secret-that-is-long-enough-123',
      userRepository: repository,
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    });

    await service.authenticate('verified-line-token');

    expect(repository.upsertFromLine).toHaveBeenCalledWith({
      lineUserId: 'U-repository-user',
      displayName: 'Repository User',
      pictureUrl: undefined,
    });
  });
});
