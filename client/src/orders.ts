import type { CartItem } from './cart';

export type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentUrl?: string;
  paymentTransactionId?: string;
  subtotalSatang: number;
  deliveryFeeSatang: number;
  totalSatang: number;
  customerNote?: string;
  items: Array<{ productId: string; productName: string; unitPriceSatang: number; quantity: number; lineTotalSatang: number }>;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Order request failed with ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export async function createOrder(items: CartItem[]): Promise<Order> {
  const response = await fetch(`${apiUrl}/api/orders`, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: items.map(({ productId, quantity }) => ({ productId, quantity })) }),
  });
  return (await responseJson<{ order: Order }>(response)).order;
}

export async function listOrders(): Promise<Order[]> {
  const response = await fetch(`${apiUrl}/api/orders`, { credentials: 'include' });
  return (await responseJson<{ orders: Order[] }>(response)).orders;
}

export async function startPayment(orderId: string): Promise<{ paymentUrl: string; order: Order }> {
  const response = await fetch(`${apiUrl}/api/orders/${orderId}/payment`, { method: 'POST', credentials: 'include' });
  return responseJson<{ paymentUrl: string; order: Order }>(response);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await responseJson(await fetch(`${apiUrl}/api/orders/${orderId}/cancel`, { method: 'POST', credentials: 'include' }));
}
