import type { Order } from './orders';
import type { Product } from './products';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Admin request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listAdminOrders(status?: string, search?: string): Promise<Order[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiUrl}/api/admin/orders${suffix}`, { credentials: 'include' });
  return (await responseJson<{ orders: Order[] }>(response)).orders;
}

export async function updateAdminOrderStatus(orderId: string, status: string): Promise<Order> {
  const response = await fetch(`${apiUrl}/api/admin/orders/${orderId}/status`, {
    method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return (await responseJson<{ order: Order }>(response)).order;
}

export async function adjustProductStock(productId: string, delta: number): Promise<Product> {
  const response = await fetch(`${apiUrl}/api/admin/products/${productId}/stock`, {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ delta }),
  });
  return (await responseJson<{ product: Product }>(response)).product;
}
