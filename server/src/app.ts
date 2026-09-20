import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter } from './trpc.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, { origin: true });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'mini-shop-api',
    timestamp: new Date().toISOString(),
  }));

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
