import { describe, expect, it, vi } from 'vitest';
import { createPaymentService } from '../src/payments/service.js';
import type { OrderRepository, PaymentOrder } from '../src/orders/repository.js';
import { createLinePayGateway, type PaymentGateway } from '../src/payments/line-pay.js';

const pendingOrder: PaymentOrder = {
  id: 'order-1', userId: 'user-1', orderNumber: 'MS-20260920-ABC123', status: 'pending', paymentStatus: 'unpaid',
  subtotalSatang: 9000, deliveryFeeSatang: 0, totalSatang: 9000,
  items: [{ productId: 'p1', productName: 'ชาไทย', unitPriceSatang: 4500, quantity: 2, lineTotalSatang: 9000 }],
};

function repository(overrides: Partial<OrderRepository> = {}): OrderRepository {
  return {
    create: vi.fn(), listByUser: vi.fn(), cancel: vi.fn(), getByUser: vi.fn(async () => pendingOrder),
    getByTransaction: vi.fn(async () => pendingOrder), setPaymentPending: vi.fn(async () => ({ ...pendingOrder, paymentStatus: 'pending' as const, paymentTransactionId: 'tx-1', paymentUrl: 'https://pay.example/tx-1' })),
    markPaid: vi.fn(async () => ({ ...pendingOrder, status: 'paid' as const, paymentStatus: 'paid' as const, paymentTransactionId: 'tx-1' })),
    ...overrides,
  };
}

describe('Payment service', () => {
  it('creates a payment request once and persists the transaction', async () => {
    const orderRepository = repository();
    const gateway: PaymentGateway = {
      requestPayment: vi.fn(async () => ({ transactionId: 'tx-1', paymentUrl: 'https://pay.example/tx-1' })),
      confirmPayment: vi.fn(),
    };
    const service = createPaymentService({ orderRepository, gateway });
    const result = await service.startPayment('user-1', 'order-1');
    expect(result.order.paymentTransactionId).toBe('tx-1');
    expect(gateway.requestPayment).toHaveBeenCalledWith(expect.objectContaining({ amountSatang: 9000 }));
    expect(orderRepository.setPaymentPending).toHaveBeenCalledWith('order-1', 'line_pay', 'tx-1', 'https://pay.example/tx-1');
  });

  it('does not call the gateway again for an already paid order', async () => {
    const orderRepository = repository({ getByUser: vi.fn(async () => ({ ...pendingOrder, paymentStatus: 'paid' as const })) });
    const gateway: PaymentGateway = { requestPayment: vi.fn(), confirmPayment: vi.fn() };
    const result = await createPaymentService({ orderRepository, gateway }).startPayment('user-1', 'order-1');
    expect(result.alreadyPaid).toBe(true);
    expect(gateway.requestPayment).not.toHaveBeenCalled();
  });

  it('does not confirm a transaction twice after it is already paid', async () => {
    const orderRepository = repository({ getByTransaction: vi.fn(async () => ({ ...pendingOrder, paymentStatus: 'paid' as const, status: 'paid' as const })) });
    const gateway: PaymentGateway = { requestPayment: vi.fn(), confirmPayment: vi.fn() };
    const result = await createPaymentService({ orderRepository, gateway }).confirmPayment('tx-1');
    expect(result.paymentStatus).toBe('paid');
    expect(gateway.confirmPayment).not.toHaveBeenCalled();
  });

  it('signs LINE Pay requests and maps the payment URL without real network calls', async () => {
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ 'X-LINE-ChannelId': 'channel-1' });
      const body = JSON.parse(String(init?.body)) as { amount: number; currency: string; orderId: string };
      expect(body).toMatchObject({ amount: 90, currency: 'THB', orderId: 'MS-1' });
      return new Response(JSON.stringify({ returnCode: '0000', info: { transactionId: 123, paymentUrl: { web: 'https://sandbox-pay/123' } } }), { status: 200 });
    });
    const gateway = createLinePayGateway({ channelId: 'channel-1', channelSecret: 'secret-1', callbackUrl: 'https://api.example/callback', cancelUrl: 'https://app.example/cancel', fetchImpl });
    const result = await gateway.requestPayment({ orderId: 'order-1', orderNumber: 'MS-1', amountSatang: 9000, items: [{ productName: 'ชาไทย', quantity: 2, unitPriceSatang: 4500 }] });
    expect(result).toEqual({ transactionId: '123', paymentUrl: 'https://sandbox-pay/123' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
