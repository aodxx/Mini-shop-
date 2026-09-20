import type { OrderRepository } from '../orders/repository.js';
import type { PaymentGateway } from './line-pay.js';

export function createPaymentService(dependencies: { orderRepository: OrderRepository; gateway: PaymentGateway }) {
  return {
    async startPayment(userId: string, orderId: string) {
      const order = await dependencies.orderRepository.getByUser(userId, orderId);
      if (!order) throw new Error('Order not found');
      if (order.paymentStatus === 'paid') return { alreadyPaid: true, paymentUrl: order.paymentUrl, order };
      if (order.paymentTransactionId && order.paymentUrl) return { alreadyPending: true, paymentUrl: order.paymentUrl, order };
      const payment = await dependencies.gateway.requestPayment({
        orderId: order.id, orderNumber: order.orderNumber, amountSatang: order.totalSatang,
        items: order.items.map((item) => ({ productName: item.productName, quantity: item.quantity, unitPriceSatang: item.unitPriceSatang })),
      });
      const updated = await dependencies.orderRepository.setPaymentPending(order.id, 'line_pay', payment.transactionId, payment.paymentUrl);
      return { alreadyPaid: false, alreadyPending: false, paymentUrl: payment.paymentUrl, order: updated };
    },

    async confirmPayment(transactionId: string) {
      const order = await dependencies.orderRepository.getByTransaction(transactionId);
      if (!order) throw new Error('Payment transaction not found');
      if (order.paymentStatus === 'paid') return order;
      await dependencies.gateway.confirmPayment(transactionId, order.totalSatang);
      const updated = await dependencies.orderRepository.markPaid(transactionId);
      if (!updated) throw new Error('Unable to mark payment as paid');
      return updated;
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
