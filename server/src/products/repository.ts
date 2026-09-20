import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { menus, type Menu } from '../db/schema.js';

export type Product = {
  id: string;
  name: string;
  description?: string;
  priceSatang: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
};

export type CreateProductInput = {
  name: string;
  description?: string;
  priceSatang: number;
  imageUrl?: string;
  category: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'name'>> & {
  name?: string;
};

export type ProductListFilter = {
  includeInactive?: boolean;
  category?: string;
};

export interface ProductRepository {
  list(filter?: ProductListFilter): Promise<Product[]>;
  findActiveByIds(ids: string[]): Promise<Product[]>;
  create(input: CreateProductInput): Promise<Product>;
  update(id: string, input: UpdateProductInput): Promise<Product | null>;
  deactivate(id: string): Promise<boolean>;
}

function toProduct(menu: Menu): Product {
  return {
    id: menu.id,
    name: menu.name,
    ...(menu.description ? { description: menu.description } : {}),
    priceSatang: menu.priceSatang,
    ...(menu.imageUrl ? { imageUrl: menu.imageUrl } : {}),
    category: menu.category,
    isActive: menu.isActive,
    sortOrder: menu.sortOrder,
  };
}

export function createProductRepository(db: Database): ProductRepository {
  return {
    async list(filter = {}) {
      const conditions = [];
      if (!filter.includeInactive) conditions.push(eq(menus.isActive, true));
      if (filter.category) conditions.push(eq(menus.category, filter.category));

      const rows = await db
        .select()
        .from(menus)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(menus.sortOrder), asc(menus.name));

      return rows.map(toProduct);
    },

    async findActiveByIds(ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select()
        .from(menus)
        .where(and(eq(menus.isActive, true), inArray(menus.id, ids)));
      return rows.map(toProduct);
    },

    async create(input) {
      const [menu] = await db
        .insert(menus)
        .values({
          name: input.name,
          priceSatang: input.priceSatang,
          category: input.category,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        })
        .returning();

      if (!menu) throw new Error('Unable to create product');
      return toProduct(menu);
    },

    async update(id, input) {
      const [menu] = await db
        .update(menus)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(menus.id, id))
        .returning();

      return menu ? toProduct(menu) : null;
    },

    async deactivate(id) {
      const [menu] = await db
        .update(menus)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(menus.id, id))
        .returning({ id: menus.id });

      return Boolean(menu);
    },
  };
}
