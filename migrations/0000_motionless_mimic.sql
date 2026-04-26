CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`time` text NOT NULL,
	`timezone` text NOT NULL,
	`message` text NOT NULL,
	`next_fire_at` integer NOT NULL,
	`last_sent_at` integer,
	`created_at` integer DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_next_fire` ON `notifications` (`next_fire_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`chat_id` integer NOT NULL,
	`created_at` integer DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000) NOT NULL
);
