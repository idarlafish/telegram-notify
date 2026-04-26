import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    message: text("message").notNull(),
    time: text("time").notNull(),         // "HH:MM" in user's tz
    timezone: text("timezone").notNull(), // IANA tz
    kind: text("kind", { enum: ["one_time", "recurring"] }).notNull(),
    weekdays: integer("weekdays"),        // bitmask Mon=1..Sun=64; non-null when recurring
    next_fire_at: integer("next_fire_at").notNull(), // UTC ms — when it next fires
    last_sent_at: integer("last_sent_at"),
    created_at: integer("created_at").notNull().default(epochMsDefault),
  },
  (t) => [
    index("idx_notifications_next_fire").on(t.next_fire_at),
    index("idx_notifications_user").on(t.user_id),
    check(
      "recurring_has_weekdays",
      sql`(${t.kind}='recurring' AND ${t.weekdays} BETWEEN 1 AND 127)
       OR (${t.kind}='one_time'  AND ${t.weekdays} IS NULL)`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
