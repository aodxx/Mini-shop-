import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createAuthService, type AuthService } from './auth.js';
import { closeDatabase, getDatabase } from './db/client.js';
import { parseEnv, type AppEnv } from './env.js';
import { createUserRepository, type UserRepository } from './users/repository.js';
import { appRouter } from './trpc.js';

const SESSION_COOKIE = 'mini_shop_session';

type AppOptions = {
  authService?: AuthService;
  env?: AppEnv;
  userRepository?: UserRepository;
};

function getSessionToken(request: FastifyRequest) {
  return request.cookies[SESSION_COOKIE];
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const env = options.env ?? parseEnv();
  const userRepository = options.userRepository
    ?? (options.authService ? undefined : createUserRepository(getDatabase()));
  const authService = options.authService ?? createAuthService({
    channelId: env.LINE_CHANNEL_ID,
    sessionSecret: env.SESSION_SECRET,
    ...(userRepository ? { userRepository } : {}),
  });

  if (!options.authService && !options.userRepository) {
    app.addHook('onClose', async () => closeDatabase());
  }

  app.register(cookie);
  app.register(cors, { origin: env.CLIENT_ORIGIN, credentials: true });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'mini-shop-api',
    timestamp: new Date().toISOString(),
  }));

  app.post<{ Body: { idToken?: string } }>('/api/auth/line', async (request, reply) => {
    if (!request.body?.idToken) {
      return reply.code(400).send({ error: 'idToken is required' });
    }

    try {
      const result = await authService.authenticate(request.body.idToken);
      reply.setCookie(SESSION_COOKIE, result.sessionToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return reply.send({ user: result.user });
    } catch {
      return reply.code(401).send({ error: 'Unable to authenticate with LINE' });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const token = getSessionToken(request);
    if (!token) return reply.code(401).send({ error: 'Not authenticated' });

    try {
      return reply.send({ user: await authService.readSession(token) });
    } catch {
      return reply.code(401).send({ error: 'Invalid session' });
    }
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }: { req: FastifyRequest }) => ({
        requestId: req.id,
      }),
    },
  });

  return app;
}
