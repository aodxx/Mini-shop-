CREATE INDEX "menus_active_sort_order_idx" ON "menus" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "menus_category_idx" ON "menus" USING btree ("category");