import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { AuthService } from '../src/auth.js';
import type { ProductRepository } from '../src/products/repository.js';
import type { OrderRepository } from '../src/orders/repository.js';

const product = {
  id: 'product-1', name: 'ชาไทย', priceSatang: 4500, stockQuantity: 10,
  reservedQuantity: 2, category: 'เครื่องดื่ม', isActive: true, sortOrder: 0,
};
const order = {
  id: 'order-1', orderNumber: 'MS-20260920-ABC', status: 'pending', paymentStatus: 'unpaid',
  subtotalSatang: 9000, deliveryFeeSatang: 0, totalSatang: 9000,
  items: [{ productId: product.id, productName: product.name, unitPriceSatang: product.priceSatang, quantity: 2, lineTotalSatang: 9000 }],
};

function createHarness(role: 'customer' | 'staff' | 'manager' | 'owner' = 'staff') {
  const authService = {
    readSession: vi.fn(async (token: string) => {
      if (token !== 'session-token') throw new Error('invalid session');
      return { id: 'user-1', lineUserId: 'line-1', displayName: 'Admin', role };
    }),
  } as unknown as AuthService;
  const productRepository = {
    list: vi.fn(async () => [product]),
    adjustStock: vi.fn(async (_id: string, delta: number) => ({ ...product, stockQuantity: product.stockQuantity + delta })),
  } as unknown as ProductRepository;
  const orderRepository = {
    listAll: vi.fn(async () => [order]),
    updateStatus: vi.fn(async (_id: string, status: string) => ({ ...order, status })),
  } as unknown as OrderRepository;
  const app = createApp({
    authService,
    productRepository,
    orderRepository,
    env: {
      NODE_ENV: 'test', PORT: 3000, DATABASE_URL: 'postgresql://localhost/test',
      SESSION_SECRET: 'test-session-secret-that-is-long-enough-123', CLIENT_ORIGIN: 'http://localhost:5173',
      LINE_CHANNEL_ID: 'line-channel',
    },
  });
  return { app, productRepository, orderRepository };
}

describe('admin dashboard API', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

  it('lists orders for staff and filters by status', async () => {
    const harness = createHarness('staff');
    apps.push(harness.app);
    const response = await harness.app.inject({
      method: 'GET', url: '/api/admin/orders?status=pending',
      headers: { cookie: 'mini_shop_session=session-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ orders: [{ id: 'order-1', status: 'pending' }] });
    expect(harness.orderRepository.listAll).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('blocks customer access to dashboard data', async () => {
    const { app } = createHarness('customer');
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/admin/orders', headers: { cookie: 'mini_shop_session=session-token' } });
    expect(response.statusCode).toBe(403);
  });

  it('updates an order status for managers', async () => {
    const harness = createHarness('manager');
    apps.push(harness.app);
    const response = await harness.app.inject({
      method: 'PATCH', url: '/api/admin/orders/order-1/status',
      headers: { cookie: 'mini_shop_session=session-token', 'content-type': 'application/json' },
      payload: { status: 'cooking' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ order: { status: 'cooking' } });
    expect(harness.orderRepository.updateStatus).toHaveBeenCalledWith('order-1', 'cooking');
  });

  it('adjusts stock for staff and rejects zero delta', async () => {
    const harness = createHarness('staff');
    apps.push(harness.app);
    const response = await harness.app.inject({
      method: 'POST', url: '/api/admin/products/product-1/stock',
      headers: { cookie: 'mini_shop_session=session-token', 'content-type': 'application/json' },
      payload: { delta: 5 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ product: { stockQuantity: 15 } });
    expect(harness.productRepository.adjustStock).toHaveBeenCalledWith('product-1', 5);

    const invalid = await harness.app.inject({
      method: 'POST', url: '/api/admin/products/product-1/stock',
      headers: { cookie: 'mini_shop_session=session-token', 'content-type': 'application/json' },
      payload: { delta: 0 },
    });
    expect(invalid.statusCode).toBe(400);
  });
});
