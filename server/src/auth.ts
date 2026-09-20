import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

const lineTokenPayloadSchema = z.object({
  iss: z.literal('https://access.line.me'),
  sub: z.string().min(1),
  aud: z.string().min(1),
  exp: z.number().int(),
  iat: z.number().int(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export type LineTokenPayload = z.infer<typeof lineTokenPayloadSchema>;

export type AuthUser = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'customer';
};

type AuthServiceOptions = {
  channelId: string;
  sessionSecret: string;
  fetchImpl?: typeof fetch;
};

type AuthResult = {
  user: AuthUser;
  sessionToken: string;
};

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

function secretKey(value: string) {
  return new TextEncoder().encode(value);
}

export function createAuthService(options: AuthServiceOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function verifyLineIdToken(idToken: string): Promise<LineTokenPayload> {
    const body = new URLSearchParams({
      id_token: idToken,
      client_id: options.channelId,
    });

    const response = await fetchImpl(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new Error('LINE ID token verification failed');
    }

    const payload = lineTokenPayloadSchema.parse(await response.json());
    if (payload.aud !== options.channelId || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('LINE ID token verification failed');
    }

    return payload;
  }

  async function createSession(user: AuthUser) {
    return new SignJWT({
      lineUserId: user.lineUserId,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.lineUserId)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey(options.sessionSecret));
  }

  async function authenticate(idToken: string): Promise<AuthResult> {
    const payload = await verifyLineIdToken(idToken);
    const user: AuthUser = {
      lineUserId: payload.sub,
      displayName: payload.name ?? 'LINE user',
      ...(payload.picture ? { pictureUrl: payload.picture } : {}),
      role: 'customer',
    };

    return { user, sessionToken: await createSession(user) };
  }

  async function readSession(sessionToken: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(sessionToken, secretKey(options.sessionSecret), {
      algorithms: ['HS256'],
    });

    if (
      typeof payload.lineUserId !== 'string' ||
      typeof payload.displayName !== 'string' ||
      payload.role !== 'customer'
    ) {
      throw new Error('Invalid session');
    }

    return {
      lineUserId: payload.lineUserId,
      displayName: payload.displayName,
      ...(typeof payload.pictureUrl === 'string' ? { pictureUrl: payload.pictureUrl } : {}),
      role: 'customer',
    };
  }

  return { authenticate, readSession, verifyLineIdToken };
}

export type AuthService = ReturnType<typeof createAuthService>;
