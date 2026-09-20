import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { orderItems, orders } from '../db/schema.js';
import type { Order, OrderStatus, PaymentStatus } from './service.js';

export type NewOrderItem = {
  productId: string;
  productName: string;
  unitPriceSatang: number;
  quantity: number;
  lineTotalSatang: number;
};

export type NewOrderInput = {
  userId: string;
  items: NewOrderItem[];
  subtotalSatang: number;
  deliveryFeeSatang: number;
  totalSatang: number;
  customerNote?: string;
};

export interface OrderRepository {
  create(input: NewOrderInput): Promise<Order>;
  listByUser(userId: string): Promise<Order[]>;
  cancel(userId: string, orderId: string): Promise<boolean>;
}

export function createOrderRepository(db: Database): OrderRepository {
  return {
    async create(input) {
      const orderNumber = `MS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      return db.transaction(async (tx) => {
        const [order] = await tx.insert(orders).values({
          orderNumber,
          userId: input.userId,
          subtotalSatang: input.subtotalSatang,
          deliveryFeeSatang: input.deliveryFeeSatang,
          totalSatang: input.totalSatang,
          ...(input.customerNote ? { customerNote: input.customerNote } : {}),
        }).returning();

        if (!order) throw new Error('Unable to create order');
        await tx.insert(orderItems).values(input.items.map((item) => ({ orderId: order.id, ...item })));
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          subtotalSatang: order.subtotalSatang,
          deliveryFeeSatang: order.deliveryFeeSatang,
          totalSatang: order.totalSatang,
          ...(order.customerNote ? { customerNote: order.customerNote } : {}),
          items: input.items,
        };
      });
    },

    async listByUser(userId) {
      const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(asc(orders.createdAt));
      const result: Order[] = [];
      for (const order of rows) {
        const items = await db.select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          unitPriceSatang: orderItems.unitPriceSatang,
          quantity: orderItems.quantity,
          lineTotalSatang: orderItems.lineTotalSatang,
        }).from(orderItems).where(eq(orderItems.orderId, order.id));
        result.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          subtotalSatang: order.subtotalSatang,
          deliveryFeeSatang: order.deliveryFeeSatang,
          totalSatang: order.totalSatang,
          ...(order.customerNote ? { customerNote: order.customerNote } : {}),
          items,
        });
      }
      return result;
    },

    async cancel(userId, orderId) {
      const [cancelled] = await db.update(orders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId), eq(orders.status, 'pending')))
        .returning({ id: orders.id });
      return Boolean(cancelled);
    },
  };
}
