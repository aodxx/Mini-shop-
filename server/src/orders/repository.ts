import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { menus, orderItems, orders } from '../db/schema.js';
import type { Order } from './service.js';

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

export type PaymentOrder = Order & { userId: string };

export interface OrderRepository {
  create(input: NewOrderInput): Promise<Order>;
  listByUser(userId: string): Promise<Order[]>;
  cancel(userId: string, orderId: string): Promise<boolean>;
  getByUser(userId: string, orderId: string): Promise<PaymentOrder | null>;
  getByTransaction(transactionId: string): Promise<PaymentOrder | null>;
  setPaymentPending(orderId: string, provider: string, transactionId: string, paymentUrl: string): Promise<PaymentOrder>;
  markPaid(transactionId: string): Promise<PaymentOrder | null>;
}

function toOrder(order: typeof orders.$inferSelect, items: NewOrderItem[]): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    ...(order.paymentProvider ? { paymentProvider: order.paymentProvider } : {}),
    ...(order.paymentTransactionId ? { paymentTransactionId: order.paymentTransactionId } : {}),
    ...(order.paymentUrl ? { paymentUrl: order.paymentUrl } : {}),
    ...(order.paidAt ? { paidAt: order.paidAt.toISOString() } : {}),
    subtotalSatang: order.subtotalSatang,
    deliveryFeeSatang: order.deliveryFeeSatang,
    totalSatang: order.totalSatang,
    ...(order.customerNote ? { customerNote: order.customerNote } : {}),
    items,
  };
}

function toPaymentOrder(order: typeof orders.$inferSelect, items: NewOrderItem[]): PaymentOrder {
  return { ...toOrder(order, items), userId: order.userId };
}

async function getItems(db: Database, orderId: string): Promise<NewOrderItem[]> {
  return db.select({
    productId: orderItems.productId,
    productName: orderItems.productName,
    unitPriceSatang: orderItems.unitPriceSatang,
    quantity: orderItems.quantity,
    lineTotalSatang: orderItems.lineTotalSatang,
  }).from(orderItems).where(eq(orderItems.orderId, orderId));
}

export function createOrderRepository(db: Database): OrderRepository {
  return {
    async create(input) {
      const orderNumber = `MS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      return db.transaction(async (tx) => {
        const productIds = input.items.map((item) => item.productId);
        const productRows = await tx.select({ id: menus.id }).from(menus).where(inArray(menus.id, productIds));
        if (productRows.length !== new Set(productIds).size) throw new Error('One or more products are unavailable');
        for (const item of input.items) {
          const [reserved] = await tx.update(menus)
            .set({ reservedQuantity: sql`${menus.reservedQuantity} + ${item.quantity}` })
            .where(and(eq(menus.id, item.productId), eq(menus.isActive, true), sql`${menus.stockQuantity} - ${menus.reservedQuantity} >= ${item.quantity}`))
            .returning({ id: menus.id });
          if (!reserved) throw new Error(`Insufficient stock for product ${item.productId}`);
        }
        const [order] = await tx.insert(orders).values({
          orderNumber, userId: input.userId, subtotalSatang: input.subtotalSatang,
          deliveryFeeSatang: input.deliveryFeeSatang, totalSatang: input.totalSatang,
          ...(input.customerNote ? { customerNote: input.customerNote } : {}),
        }).returning();
        if (!order) throw new Error('Unable to create order');
        await tx.insert(orderItems).values(input.items.map((item) => ({ orderId: order.id, ...item })));
        return toOrder(order, input.items);
      });
    },

    async listByUser(userId) {
      const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(asc(orders.createdAt));
      return Promise.all(rows.map(async (order) => toOrder(order, await getItems(db, order.id))));
    },

    async cancel(userId, orderId) {
      return db.transaction(async (tx) => {
        const [order] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId), eq(orders.status, 'pending')));
        if (!order) return false;
        const items = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId));
        for (const item of items) {
          await tx.update(menus).set({ reservedQuantity: sql`greatest(${menus.reservedQuantity} - ${item.quantity}, 0)` }).where(eq(menus.id, item.productId));
        }
        await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, orderId));
        return true;
      });
    },

    async getByUser(userId, orderId) {
      const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
      return order ? toPaymentOrder(order, await getItems(db, order.id)) : null;
    },

    async getByTransaction(transactionId) {
      const [order] = await db.select().from(orders).where(eq(orders.paymentTransactionId, transactionId));
      return order ? toPaymentOrder(order, await getItems(db, order.id)) : null;
    },

    async setPaymentPending(orderId, provider, transactionId, paymentUrl) {
      const [order] = await db.update(orders).set({ paymentProvider: provider, paymentTransactionId: transactionId, paymentUrl, paymentStatus: 'pending', updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
      if (!order) throw new Error('Order not found');
      return toPaymentOrder(order, await getItems(db, order.id));
    },

    async markPaid(transactionId) {
      const [order] = await db.update(orders).set({ paymentStatus: 'paid', status: 'paid', paidAt: new Date(), updatedAt: new Date() }).where(and(eq(orders.paymentTransactionId, transactionId), eq(orders.paymentStatus, 'pending'))).returning();
      if (!order) {
        const existing = await this.getByTransaction(transactionId);
        return existing?.paymentStatus === 'paid' ? existing : null;
      }
      return toPaymentOrder(order, await getItems(db, order.id));
    },
  };
}
