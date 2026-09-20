export type Product = {
  id: string;
  name: string;
  description?: string;
  priceSatang: number;
  stockQuantity: number;
  reservedQuantity: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
};

export type ProductInput = {
  name: string;
  description?: string;
  priceSatang: number;
  stockQuantity?: number;
  category: string;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Product request failed with ${response.status}`);
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export async function listProducts(includeInactive = false): Promise<Product[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  const response = await fetch(`${apiUrl}/api/products${query}`, { credentials: 'include' });
  return (await responseJson<{ products: Product[] }>(response)).products;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const response = await fetch(`${apiUrl}/api/products`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await responseJson<{ product: Product }>(response)).product;
}

export async function deactivateProduct(id: string): Promise<void> {
  await responseJson(await fetch(`${apiUrl}/api/products/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
}
