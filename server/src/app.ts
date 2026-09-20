import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createAuthService, type AuthService } from './auth.js';
import { closeDatabase, getDatabase } from './db/client.js';
import { parseEnv, type AppEnv } from './env.js';
import {
  createProductRepository,
  type CreateProductInput,
  type ProductRepository,
  type UpdateProductInput,
} from './products/repository.js';
import { createUserRepository, type UserRepository } from './users/repository.js';
import { appRouter } from './trpc.js';
import { z } from 'zod';

const SESSION_COOKIE = 'mini_shop_session';

type AppOptions = {
  authService?: AuthService;
  env?: AppEnv;
  userRepository?: UserRepository;
  productRepository?: ProductRepository;
};

function getSessionToken(request: FastifyRequest) {
  return request.cookies[SESSION_COOKIE];
}

export function createApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const env = options.env ?? parseEnv();
  const userRepository = options.userRepository
    ?? (options.authService ? undefined : createUserRepository(getDatabase()));
  const productRepository = options.productRepository
    ?? (options.authService ? undefined : createProductRepository(getDatabase()));
  const authService = options.authService ?? createAuthService({
    channelId: env.LINE_CHANNEL_ID,
    sessionSecret: env.SESSION_SECRET,
    ...(userRepository ? { userRepository } : {}),
  });

  if (!options.authService && !options.userRepository && !options.productRepository) {
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

  const productCreateSchema = z.object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),
    priceSatang: z.number().int().nonnegative(),
    imageUrl: z.string().url().optional(),
    category: z.string().trim().min(1).max(80).default('ทั่วไป'),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().nonnegative().default(0),
  });
  const productUpdateSchema = productCreateSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'At least one product field is required',
  );
  const productManagers = new Set(['staff', 'manager', 'owner']);

  async function requireProductManager(request: FastifyRequest, reply: FastifyReply) {
    const token = getSessionToken(request);
    if (!token) {
      await reply.code(401).send({ error: 'Not authenticated' });
      return null;
    }

    try {
      const user = await authService.readSession(token);
      if (!productManagers.has(user.role)) {
        await reply.code(403).send({ error: 'Product manager role required' });
        return null;
      }
      return user;
    } catch {
      await reply.code(401).send({ error: 'Invalid session' });
      return null;
    }
  }

  app.get<{ Querystring: { category?: string; includeInactive?: string } }>('/api/products', async (request, reply) => {
    if (!productRepository) return reply.code(503).send({ error: 'Product repository is unavailable' });
    const includeInactive = request.query.includeInactive === 'true';
    if (includeInactive && !(await requireProductManager(request, reply))) return reply;

    const products = await productRepository.list({
      ...(request.query.category ? { category: request.query.category } : {}),
      includeInactive,
    });
    return reply.send({ products });
  });

  app.post<{ Body: CreateProductInput }>('/api/products', async (request, reply) => {
    if (!productRepository || !(await requireProductManager(request, reply))) return reply;

    const parsed = productCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid product payload' });
    const input: CreateProductInput = {
      name: parsed.data.name,
      priceSatang: parsed.data.priceSatang,
      category: parsed.data.category,
      isActive: parsed.data.isActive,
      sortOrder: parsed.data.sortOrder,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
    };
    const product = await productRepository.create(input);
    return reply.code(201).send({ product });
  });

  app.patch<{ Params: { id: string }; Body: UpdateProductInput }>('/api/products/:id', async (request, reply) => {
    if (!productRepository || !(await requireProductManager(request, reply))) return reply;

    const parsed = productUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid product payload' });
    const input = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    ) as UpdateProductInput;
    const product = await productRepository.update(request.params.id, input);
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return reply.send({ product });
  });

  app.delete<{ Params: { id: string } }>('/api/products/:id', async (request, reply) => {
    if (!productRepository || !(await requireProductManager(request, reply))) return reply;
    const deactivated = await productRepository.deactivate(request.params.id);
    if (!deactivated) return reply.code(404).send({ error: 'Product not found' });
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
