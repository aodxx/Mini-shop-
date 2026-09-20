import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { AuthService } from '../src/auth.js';
import type { Product, ProductRepository } from '../src/products/repository.js';

const env = {
  NODE_ENV: 'test' as const,
  PORT: 3000,
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/mini_shop',
  SESSION_SECRET: 'test-session-secret-that-is-long-enough-123',
  CLIENT_ORIGIN: 'http://localhost:5173',
  LINE_CHANNEL_ID: 'test-channel',
};

const product: Product = {
  id: 'product-1',
  name: 'ชาไทย',
  description: 'ชาไทยเย็น',
  priceSatang: 4500,
  imageUrl: undefined,
  category: 'เครื่องดื่ม',
  isActive: true,
  sortOrder: 1,
};

function makeProductRepository(): ProductRepository {
  return {
    list: vi.fn(async () => [product]),
    findActiveByIds: vi.fn(async () => [product]),
    create: vi.fn(async (input) => ({ ...product, ...input, id: 'product-created' })),
    update: vi.fn(async (id, input) => id === product.id ? { ...product, ...input } : null),
    deactivate: vi.fn(async (id) => id === product.id),
  };
}

function makeAuthService(): AuthService {
  return {
    authenticate: vi.fn(),
    verifyLineIdToken: vi.fn(),
    readSession: vi.fn(async (token: string) => {
      if (token === 'staff-session') return { lineUserId: 'staff', displayName: 'Staff', role: 'staff' as const };
      if (token === 'customer-session') return { lineUserId: 'customer', displayName: 'Customer', role: 'customer' as const };
      throw new Error('Invalid session');
    }),
  };
}

describe('Product management API', () => {
  it('lists public products and protects management routes by role', async () => {
    const repository = makeProductRepository();
    const app = createApp({ env, authService: makeAuthService(), productRepository: repository });
    await app.ready();

    const publicList = await app.inject({ method: 'GET', url: '/api/products' });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json()).toEqual({ products: [product] });

    const customerCreate = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie: 'mini_shop_session=customer-session' },
      payload: { name: 'กาแฟ', priceSatang: 5000, category: 'เครื่องดื่ม' },
    });
    expect(customerCreate.statusCode).toBe(403);

    const staffCreate = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: { cookie: 'mini_shop_session=staff-session' },
      payload: { name: 'กาแฟ', priceSatang: 5000, category: 'เครื่องดื่ม' },
    });
    expect(staffCreate.statusCode).toBe(201);
    expect(repository.create).toHaveBeenCalledWith({
      name: 'กาแฟ',
      priceSatang: 5000,
      category: 'เครื่องดื่ม',
      isActive: true,
      sortOrder: 0,
    });

    await app.close();
  });

  it('updates and deactivates a product for staff', async () => {
    const repository = makeProductRepository();
    const app = createApp({ env, authService: makeAuthService(), productRepository: repository });
    await app.ready();
    const headers = { cookie: 'mini_shop_session=staff-session' };

    const update = await app.inject({
      method: 'PATCH',
      url: '/api/products/product-1',
      headers,
      payload: { priceSatang: 5500, isActive: false },
    });
    expect(update.statusCode).toBe(200);
    expect(repository.update).toHaveBeenCalledWith('product-1', { priceSatang: 5500, isActive: false });

    const remove = await app.inject({ method: 'DELETE', url: '/api/products/product-1', headers });
    expect(remove.statusCode).toBe(204);
    expect(repository.deactivate).toHaveBeenCalledWith('product-1');

    await app.close();
  });
});
