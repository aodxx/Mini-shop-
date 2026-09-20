import type { Product } from './products';

export type CartItem = {
  productId: string;
  name: string;
  priceSatang: number;
  quantity: number;
};

const CART_KEY = 'mini-shop-cart';

export function loadCart(): CartItem[] {
  try {
    const value = localStorage.getItem(CART_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addProductToCart(items: CartItem[], product: Product): CartItem[] {
  const existing = items.find((item) => item.productId === product.id);
  const next = existing
    ? items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
    : [...items, { productId: product.id, name: product.name, priceSatang: product.priceSatang, quantity: 1 }];
  saveCart(next);
  return next;
}

export function updateCartQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  const next = quantity < 1 ? items.filter((item) => item.productId !== productId) : items.map((item) => item.productId === productId ? { ...item, quantity: Math.min(quantity, 99) } : item);
  saveCart(next);
  return next;
}

export function clearCart() {
  saveCart([]);
}
