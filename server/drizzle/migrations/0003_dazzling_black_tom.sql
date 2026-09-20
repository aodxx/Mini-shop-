ALTER TABLE "menus" ADD COLUMN "stock_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "reserved_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" varchar(40);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_transaction_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_transaction_id_unique" UNIQUE("payment_transaction_id");