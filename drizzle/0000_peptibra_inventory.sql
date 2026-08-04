CREATE TABLE `products` (
 `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `sku` text NOT NULL,
 `category` text DEFAULT 'Péptido' NOT NULL, `concentration` text DEFAULT '' NOT NULL,
 `stock` integer DEFAULT 0 NOT NULL, `reorder_point` integer DEFAULT 5 NOT NULL,
 `price` real DEFAULT 0 NOT NULL, `status` text DEFAULT 'active' NOT NULL,
 `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);
--> statement-breakpoint
CREATE INDEX `idx_products_status_stock` ON `products` (`status`,`stock`);
--> statement-breakpoint
CREATE TABLE `inventory_movements` (
 `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `product_id` integer NOT NULL,
 `change` integer NOT NULL, `reason` text NOT NULL, `actor_id` text NOT NULL,
 `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
 FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_movements_product_created` ON `inventory_movements` (`product_id`,`created_at`);
