import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { createAuthService, type AuthService } from './auth.js';
import { closeDatabase, getDatabase } from './db/client.js';
import { parseEnv, type AppEnv } from './env.js';
import { createOrderRepository, type OrderRepository } from './orders/repository.js';
import { createOrderService, type OrderService } from './orders/service.js';
import { createLinePayGateway } from './payments/line-pay.js';
import { createPaymentService, type PaymentService } from './payments/service.js';
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
  orderRepository?: OrderRepository;
  orderService?: OrderService;
  paymentService?: PaymentService;
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
  const orderRepository = options.orderRepository
    ?? (options.authService ? undefined : createOrderRepository(getDatabase()));
  const authService = options.authService ?? createAuthService({
    channelId: env.LINE_CHANNEL_ID,
    sessionSecret: env.SESSION_SECRET,
    ...(userRepository ? { userRepository } : {}),
  });
  const orderService = options.orderService ?? (
    productRepository && orderRepository
      ? createOrderService({ productRepository, orderRepository })
      : undefined
  );
  const paymentService = options.paymentService ?? (
    orderRepository && env.LINE_PAY_CHANNEL_ID && env.LINE_PAY_CHANNEL_SECRET && env.PAYMENT_CALLBACK_URL
      ? createPaymentService({
        orderRepository,
        gateway: createLinePayGateway({
          channelId: env.LINE_PAY_CHANNEL_ID,
          channelSecret: env.LINE_PAY_CHANNEL_SECRET,
          environment: env.LINE_PAY_ENV ?? 'sandbox',
          callbackUrl: env.PAYMENT_CALLBACK_URL,
          cancelUrl: env.CLIENT_ORIGIN,
          ...(env.LINE_PAY_MERCHANT_DEVICE_PROFILE_ID ? { merchantDeviceProfileId: env.LINE_PAY_MERCHANT_DEVICE_PROFILE_ID } : {}),
        }),
      })
      : undefined
  );

  if (!options.authService && !options.userRepository && !options.productRepository && !options.orderRepository) {
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
    stockQuantity: z.number().int().nonnegative().default(0),
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

  const orderStatuses = z.enum(['pending', 'paid', 'cooking', 'ready', 'completed', 'cancelled']);
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    return requireProductManager(request, reply);
  }

  app.get('/api/admin/database', async (request, reply) => {
    if (!userRepository || !(await requireAdmin(request, reply))) return reply;

    try {
      const users = await userRepository.listForAdmin(50);
      return reply.send({
        database: {
          status: 'connected',
          provider: 'postgresql',
          checkedAt: new Date().toISOString(),
        },
        users,
      });
    } catch {
      return reply.code(503).send({ error: 'Database connection check failed' });
    }
  });

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
      stockQuantity: parsed.data.stockQuantity,
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

  app.get<{ Querystring: { status?: string; search?: string } }>('/api/admin/orders', async (request, reply) => {
    if (!orderRepository || !(await requireAdmin(request, reply))) return reply;
    const parsed = z.object({ status: orderStatuses.optional(), search: z.string().trim().max(80).optional() }).safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid admin order filter' });
    const orders = await orderRepository.listAll({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.search ? { search: parsed.data.search } : {}),
    });
    return reply.send({ orders });
  });

  app.patch<{ Params: { id: string }; Body: { status?: string } }>('/api/admin/orders/:id/status', async (request, reply) => {
    if (!orderRepository || !(await requireAdmin(request, reply))) return reply;
    const parsed = z.object({ status: orderStatuses }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid order status' });
    const order = await orderRepository.updateStatus(request.params.id, parsed.data.status);
    if (!order) return reply.code(404).send({ error: 'Order not found' });
    return reply.send({ order });
  });

  app.post<{ Params: { id: string }; Body: { delta?: number } }>('/api/admin/products/:id/stock', async (request, reply) => {
    if (!productRepository || !(await requireAdmin(request, reply))) return reply;
    const parsed = z.object({ delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Stock delta must be a non-zero integer' });
    const product = await productRepository.adjustStock(request.params.id, parsed.data.delta);
    if (!product) return reply.code(409).send({ error: 'Product not found or stock cannot be below reserved quantity' });
    return reply.send({ product });
  });

  const orderCreateSchema = z.object({
    items: z.array(z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).max(99),
      unitPriceSatang: z.number().int().nonnegative().optional(),
    })).min(1).max(50),
    customerNote: z.string().trim().max(1000).optional(),
  });

  async function requireOrderUser(request: FastifyRequest, reply: FastifyReply) {
    const token = getSessionToken(request);
    if (!token) {
      await reply.code(401).send({ error: 'Not authenticated' });
      return null;
    }
    try {
      const user = await authService.readSession(token);
      if (!user.id) {
        await reply.code(409).send({ error: 'User is not persisted' });
        return null;
      }
      return user;
    } catch {
      await reply.code(401).send({ error: 'Invalid session' });
      return null;
    }
  }

  app.post<{ Body: { items: Array<{ productId: string; quantity: number; unitPriceSatang?: number }>; customerNote?: string } }>('/api/orders', async (request, reply) => {
    if (!orderService) return reply.code(503).send({ error: 'Order service is unavailable' });
    const user = await requireOrderUser(request, reply);
    if (!user) return reply;
    const parsed = orderCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid order payload' });

    try {
      const input = {
        userId: user.id!,
        items: parsed.data.items.map(({ productId, quantity, unitPriceSatang }) => ({
          productId,
          quantity,
          ...(unitPriceSatang !== undefined ? { unitPriceSatang } : {}),
        })),
        ...(parsed.data.customerNote !== undefined ? { customerNote: parsed.data.customerNote } : {}),
      };
      const order = await orderService.createOrder(input);
      return reply.code(201).send({ order });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create order';
      return reply.code(400).send({ error: message });
    }
  });

  app.get('/api/orders', async (request, reply) => {
    if (!orderService) return reply.code(503).send({ error: 'Order service is unavailable' });
    const user = await requireOrderUser(request, reply);
    if (!user) return reply;
    return reply.send({ orders: await orderService.listOrders(user.id!) });
  });

  app.post<{ Params: { id: string } }>('/api/orders/:id/cancel', async (request, reply) => {
    if (!orderService) return reply.code(503).send({ error: 'Order service is unavailable' });
    const user = await requireOrderUser(request, reply);
    if (!user) return reply;
    const cancelled = await orderService.cancelOrder(user.id!, request.params.id);
    if (!cancelled) return reply.code(409).send({ error: 'Order cannot be cancelled' });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/orders/:id/payment', async (request, reply) => {
    if (!paymentService) return reply.code(503).send({ error: 'Payment gateway is not configured' });
    const user = await requireOrderUser(request, reply);
    if (!user) return reply;
    try {
      const result = await paymentService.startPayment(user.id!, request.params.id);
      return reply.send(result);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Unable to start payment' });
    }
  });

  app.get<{ Querystring: { transactionId?: string; orderId?: string } }>('/api/payments/line/confirm', async (request, reply) => {
    if (!paymentService) return reply.code(503).send({ error: 'Payment gateway is not configured' });
    if (!request.query.transactionId) return reply.code(400).send({ error: 'transactionId is required' });
    try {
      const order = await paymentService.confirmPayment(request.query.transactionId);
      return reply.redirect(`${env.CLIENT_ORIGIN}/?payment=success&orderId=${encodeURIComponent(order.id)}`);
    } catch (error) {
      return reply.redirect(`${env.CLIENT_ORIGIN}/?payment=failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Payment failed')}`);
    }
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
