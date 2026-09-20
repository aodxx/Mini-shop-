export const ORDER_STATUSES = [
  'pending',
  'paid',
  'cooking',
  'ready',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const APP_NAME = 'Mini Shop';
