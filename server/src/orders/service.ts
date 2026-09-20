import type { OrderRepository, NewOrderInput, NewOrderItem } from './repository.js';
import type { ProductRepository } from '../products/repository.js';

export type OrderStatus = 'pending' | 'paid' | 'cooking' | 'ready' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: string;
  paymentTransactionId?: string;
  paymentUrl?: string;
  paidAt?: string;
  subtotalSatang: number;
  deliveryFeeSatang: number;
  totalSatang: number;
  customerNote?: string;
  items: NewOrderItem[];
};

export type CartItemInput = {
  productId: string;
  quantity: number;
  unitPriceSatang?: number;
};

export type CreateOrderInput = {
  userId: string;
  items: CartItemInput[];
  customerNote?: string;
};

export function createOrderService(dependencies: {
  productRepository: ProductRepository;
  orderRepository: OrderRepository;
}) {
  return {
    async createOrder(input: CreateOrderInput): Promise<Order> {
      if (input.items.length === 0) throw new Error('Cart cannot be empty');
      const quantities = new Map<string, number>();
      for (const item of input.items) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
          throw new Error('Invalid item quantity');
        }
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }

      const products = await dependencies.productRepository.findActiveByIds([...quantities.keys()]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      if (productsById.size !== quantities.size) throw new Error('One or more products are unavailable');

      const items: NewOrderItem[] = [...quantities.entries()].map(([productId, quantity]) => {
        const product = productsById.get(productId);
        if (!product) throw new Error('One or more products are unavailable');
        if (product.stockQuantity - product.reservedQuantity < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }
        return {
          productId,
          productName: product.name,
          unitPriceSatang: product.priceSatang,
          quantity,
          lineTotalSatang: product.priceSatang * quantity,
        };
      });
      const subtotalSatang = items.reduce((total, item) => total + item.lineTotalSatang, 0);
      const deliveryFeeSatang = 0;
      const createInput: NewOrderInput = {
        userId: input.userId,
        items,
        subtotalSatang,
        deliveryFeeSatang,
        totalSatang: subtotalSatang + deliveryFeeSatang,
        ...(input.customerNote ? { customerNote: input.customerNote } : {}),
      };
      return dependencies.orderRepository.create(createInput);
    },

    listOrders(userId: string) {
      return dependencies.orderRepository.listByUser(userId);
    },

    cancelOrder(userId: string, orderId: string) {
      return dependencies.orderRepository.cancel(userId, orderId);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
