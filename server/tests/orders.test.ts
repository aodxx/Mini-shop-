import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createOrderService, type OrderRepository } from '../src/orders/service.js';
import type { ProductRepository } from '../src/products/repository.js';

const menuProduct = {
  id: 'product-1',
  name: 'ชาไทย',
  description: 'ชาไทยเย็น',
  priceSatang: 4500,
  category: 'เครื่องดื่ม',
  isActive: true,
  sortOrder: 1,
};

describe('Order service', () => {
  it('calculates totals from current database prices, not client prices', async () => {
    const productRepository: ProductRepository = {
      list: vi.fn(),
      findActiveByIds: vi.fn(async () => [menuProduct]),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    const orderRepository: OrderRepository = {
      create: vi.fn(async (input) => ({
        id: 'order-1',
        orderNumber: 'MS-20260920-ABC123',
        status: 'pending' as const,
        paymentStatus: 'unpaid' as const,
        subtotalSatang: input.subtotalSatang,
        deliveryFeeSatang: 0,
        totalSatang: input.subtotalSatang,
        customerNote: input.customerNote,
        items: input.items,
      })),
      listByUser: vi.fn(),
      cancel: vi.fn(),
    };
    const service = createOrderService({ productRepository, orderRepository });

    const order = await service.createOrder({
      userId: 'user-1',
      items: [{ productId: 'product-1', quantity: 2, unitPriceSatang: 1 }],
    });

    expect(order.subtotalSatang).toBe(9000);
    expect(orderRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      subtotalSatang: 9000,
      items: [{ productId: 'product-1', productName: 'ชาไทย', unitPriceSatang: 4500, quantity: 2, lineTotalSatang: 9000 }],
    }));
  });

  it('rejects a cart containing an inactive or unknown product', async () => {
    const productRepository: ProductRepository = {
      list: vi.fn(),
      findActiveByIds: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    const orderRepository: OrderRepository = {
      create: vi.fn(),
      listByUser: vi.fn(),
      cancel: vi.fn(),
    };
    const service = createOrderService({ productRepository, orderRepository });

    await expect(service.createOrder({
      userId: 'user-1',
      items: [{ productId: 'missing', quantity: 1 }],
    })).rejects.toThrow('One or more products are unavailable');
    expect(orderRepository.create).not.toHaveBeenCalled();
  });

  it('creates an order only for an authenticated persisted user', async () => {
    const productRepository: ProductRepository = {
      list: vi.fn(),
      findActiveByIds: vi.fn(async () => [menuProduct]),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    const orderRepository: OrderRepository = {
      create: vi.fn(async (input) => ({
        id: 'order-1', orderNumber: 'MS-20260920-ABC123', status: 'pending' as const,
        paymentStatus: 'unpaid' as const, subtotalSatang: input.subtotalSatang,
        deliveryFeeSatang: 0, totalSatang: input.totalSatang, items: input.items,
      })),
      listByUser: vi.fn(async () => []),
      cancel: vi.fn(async () => true),
    };
    const env = {
      NODE_ENV: 'test' as const, PORT: 3000,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/mini_shop',
      SESSION_SECRET: 'test-session-secret-that-is-long-enough-123',
      CLIENT_ORIGIN: 'http://localhost:5173', LINE_CHANNEL_ID: 'test-channel',
    };
    const app = createApp({
      env,
      productRepository,
      orderRepository,
      authService: {
        authenticate: vi.fn(), verifyLineIdToken: vi.fn(),
        readSession: vi.fn(async (token: string) => {
          if (token !== 'session') throw new Error('Invalid session');
          return { id: 'user-1', lineUserId: 'U1', displayName: 'Customer', role: 'customer' as const };
        }),
      },
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST', url: '/api/orders', headers: { cookie: 'mini_shop_session=session' },
      payload: { items: [{ productId: 'product-1', quantity: 2, unitPriceSatang: 1 }] },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().order.totalSatang).toBe(9000);

    const unauthenticated = await app.inject({ method: 'GET', url: '/api/orders' });
    expect(unauthenticated.statusCode).toBe(401);
    await app.close();
  });
});
