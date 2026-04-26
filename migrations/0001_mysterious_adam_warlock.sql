PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`message` text NOT NULL,
	`time` text NOT NULL,
	`timezone` text NOT NULL,
	`kind` text NOT NULL,
	`weekdays` integer,
	`next_fire_at` integer NOT NULL,
	`last_sent_at` integer,
	`created_at` integer DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recurring_has_weekdays" CHECK(("__new_notifications"."kind"='recurring' AND "__new_notifications"."weekdays" BETWEEN 1 AND 127)
       OR ("__new_notifications"."kind"='one_time'  AND "__new_notifications"."weekdays" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "user_id", "message", "time", "timezone", "kind", "weekdays", "next_fire_at", "last_sent_at", "created_at") SELECT "id", "user_id", "message", "time", "timezone", "kind", "weekdays", "next_fire_at", "last_sent_at", "created_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_notifications_next_fire` ON `notifications` (`next_fire_at`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`);