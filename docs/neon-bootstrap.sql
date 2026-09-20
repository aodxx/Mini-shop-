-- Mini Shop Neon bootstrap schema
--
-- PURPOSE
--   Manual SQL equivalent of the current Drizzle migrations for an EMPTY Neon database.
--
-- IMPORTANT
--   Choose exactly one setup path:
--   A) Recommended: pnpm --filter @mini-shop/server db:migrate
--   B) Manual: run this file once in Neon SQL Editor.
--
-- Do not run this file and then run the existing Drizzle migrations on the same
-- empty database unless you also reconcile Drizzle's migration history. Otherwise
-- Drizzle will try to create the same tables again.
--
-- This file intentionally does not seed a real owner/admin user. A real LINE user
-- must log in first, then an authorized operator can promote that user to owner.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.user_role AS ENUM ('customer', 'staff', 'manager', 'owner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'cooking', 'ready', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id varchar(128) UNIQUE,
  display_name varchar(160) NOT NULL,
  picture_url varchar(500),
  role public.user_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  description varchar(1000),
  price_satang integer NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  image_url varchar(500),
  category varchar(80) NOT NULL DEFAULT 'ทั่วไป',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(40) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_provider varchar(40),
  payment_transaction_id varchar(100) UNIQUE,
  payment_url varchar(1000),
  paid_at timestamptz,
  subtotal_satang integer NOT NULL,
  delivery_fee_satang integer NOT NULL DEFAULT 0,
  total_satang integer NOT NULL,
  customer_note varchar(1000),
  delivery_address jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.menus(id),
  product_name varchar(160) NOT NULL,
  unit_price_satang integer NOT NULL,
  quantity integer NOT NULL,
  line_total_satang integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menus_active_sort_order_idx
  ON public.menus USING btree (is_active, sort_order);

CREATE INDEX IF NOT EXISTS menus_category_idx
  ON public.menus USING btree (category);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items USING btree (order_id);

CREATE INDEX IF NOT EXISTS order_items_product_id_idx
  ON public.order_items USING btree (product_id);

-- Safety constraints used by stock reservation and price calculations.
-- These match the domain invariants documented in DATABASE.md.
DO $$
BEGIN
  ALTER TABLE public.menus
    ADD CONSTRAINT menus_stock_nonnegative_chk
    CHECK (stock_quantity >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.menus
    ADD CONSTRAINT menus_reserved_nonnegative_chk
    CHECK (reserved_quantity >= 0 AND reserved_quantity <= stock_quantity);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.menus
    ADD CONSTRAINT menus_price_nonnegative_chk
    CHECK (price_satang >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_quantity_positive_chk
    CHECK (quantity > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_price_nonnegative_chk
    CHECK (unit_price_satang >= 0 AND line_total_satang >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMIT;

-- Verification queries: run separately after COMMIT.
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
--
-- SELECT typname, enumlabel
-- FROM pg_enum
-- JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
-- WHERE typname IN ('user_role', 'order_status', 'payment_status')
-- ORDER BY typname, enumsortorder;
--
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY indexname;
