import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Mirrors migrations/0001_initial.sql exactly. Until drizzle-kit owns
// migrations, keep this file in lockstep with the SQL by hand.
const epochMsDefault = sql`(CAST(strftime('%s', 'now') AS INTEGER) * 1000)`;

export const users = sqliteTable("users", {
  // Telegram user id (also our PK).
  id: integer("id").primaryKey(),
  // Chat to deliver notifications to. Equal to id in private chats.
  chat_id: integer("chat_id").notNull(),
  created_at: integer("created_at").notNull().default(epochMsDefault),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    user_id: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    time: text("time").notNull(),         // "HH:MM"
    timezone: text("timezone").notNull(), // IANA tz
    message: text("message").notNull(),
    next_fire_at: integer("next_fire_at").notNull(), // UTC ms
    last_sent_at: integer("last_sent_at"),
    created_at: integer("created_at").notNull().default(epochMsDefault),
  },
  (table) => [
    index("idx_notifications_next_fire").on(table.next_fire_at),
    index("idx_notifications_user").on(table.user_id),
  ],
);

export type User = typeof users.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
