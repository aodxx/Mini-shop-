import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['customer', 'staff', 'manager', 'owner']);
export const orderStatus = pgEnum('order_status', [
  'pending',
  'paid',
  'cooking',
  'ready',
  'completed',
  'cancelled',
]);
export const paymentStatus = pgEnum('payment_status', ['unpaid', 'pending', 'paid', 'failed', 'refunded']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  lineUserId: varchar('line_user_id', { length: 128 }).unique(),
  displayName: varchar('display_name', { length: 160 }).notNull(),
  pictureUrl: varchar('picture_url', { length: 500 }),
  role: userRole('role').notNull().default('customer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const menus = pgTable('menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  description: varchar('description', { length: 1000 }),
  priceSatang: integer('price_satang').notNull(),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  reservedQuantity: integer('reserved_quantity').notNull().default(0),
  imageUrl: varchar('image_url', { length: 500 }),
  category: varchar('category', { length: 80 }).notNull().default('ทั่วไป'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeSortOrderIdx: index('menus_active_sort_order_idx').on(table.isActive, table.sortOrder),
  categoryIdx: index('menus_category_idx').on(table.category),
}));

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 40 }).notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: orderStatus('status').notNull().default('pending'),
  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),
  paymentProvider: varchar('payment_provider', { length: 40 }),
  paymentTransactionId: varchar('payment_transaction_id', { length: 100 }).unique(),
  paymentUrl: varchar('payment_url', { length: 1000 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  subtotalSatang: integer('subtotal_satang').notNull(),
  deliveryFeeSatang: integer('delivery_fee_satang').notNull().default(0),
  totalSatang: integer('total_satang').notNull(),
  customerNote: varchar('customer_note', { length: 1000 }),
  deliveryAddress: jsonb('delivery_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => menus.id),
  productName: varchar('product_name', { length: 160 }).notNull(),
  unitPriceSatang: integer('unit_price_satang').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotalSatang: integer('line_total_satang').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdIdx: index('order_items_order_id_idx').on(table.orderId),
  productIdIdx: index('order_items_product_id_idx').on(table.productId),
}));

export type User = typeof users.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
