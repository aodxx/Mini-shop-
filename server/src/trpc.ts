import { initTRPC } from '@trpc/server';

export type AppContext = {
  requestId: string;
};

const t = initTRPC.context<AppContext>().create();

export const appRouter = t.router({
  system: t.router({
    health: t.procedure.query(({ ctx }) => ({
      status: 'ok' as const,
      service: 'mini-shop-api',
      requestId: ctx.requestId,
    })),
  }),
});

export type AppRouter = typeof appRouter;
