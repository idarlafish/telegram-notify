import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const epochMsDefault = sql`(CAST(strftime('%s', 'now') AS INTEGER) * 1000)`;

// Per-user DO storage. Notifications table — no user_id column because the
// DO IS the user (its name = `user:${telegramId}`).
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    message: text("message").notNull(), // ciphertext (AES-GCM, base64)
    time: text("time").notNull(), // "HH:MM" in user's tz
    timezone: text("timezone").notNull(), // IANA
    kind: text("kind", { enum: ["one_time", "recurring"] }).notNull(),
    weekdays: integer("weekdays"), // bitmask Mon=1..Sun=64; non-null when recurring
    next_fire_at: integer("next_fire_at").notNull(), // UTC ms
    last_sent_at: integer("last_sent_at"),
    created_at: integer("created_at").notNull().default(epochMsDefault),
  },
  (t) => [
    index("idx_next_fire").on(t.next_fire_at),
    check(
      "recurring_has_weekdays",
      sql`(${t.kind}='recurring' AND ${t.weekdays} BETWEEN 1 AND 127)
       OR (${t.kind}='one_time'  AND ${t.weekdays} IS NULL)`,
    ),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
