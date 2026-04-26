import { computeNextFireAt } from "../lib/time";
import type { Env } from "../env";

export interface Notification {
  id: string;
  user_id: number;
  time: string;            // "HH:MM"
  timezone: string;        // IANA tz
  message: string;
  next_fire_at: number;    // UTC ms
  last_sent_at: number | null;
  created_at: number;
}

export interface NotificationInput {
  time: string;
  timezone: string;
  message: string;
}

export type DueNotification = Notification & { chat_id: number };

// Catch firings missed by a previous cron tick (worker briefly unavailable).
const LOOKBACK_MS = 5 * 60_000;

export async function listByUser(env: Env, userId: number): Promise<Notification[]> {
  const r = await env.DB.prepare(
    `SELECT id, user_id, time, timezone, message, next_fire_at, last_sent_at, created_at
     FROM notifications WHERE user_id = ? ORDER BY time`,
  )
    .bind(userId)
    .all<Notification>();
  return r.results;
}

export async function createNotification(
  env: Env,
  userId: number,
  input: NotificationInput,
): Promise<Notification> {
  const id = crypto.randomUUID();
  const next = computeNextFireAt(input.time, input.timezone);
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, time, timezone, message, next_fire_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, input.time, input.timezone, input.message, next)
    .run();

  const inserted = await env.DB.prepare(
    `SELECT id, user_id, time, timezone, message, next_fire_at, last_sent_at, created_at
     FROM notifications WHERE id = ?`,
  )
    .bind(id)
    .first<Notification>();
  if (!inserted) throw new Error("insert returned no row");
  return inserted;
}

export async function deleteNotification(
  env: Env,
  userId: number,
  id: string,
): Promise<boolean> {
  const r = await env.DB.prepare(
    `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export async function findDueNotifications(
  env: Env,
  nowMs: number,
): Promise<DueNotification[]> {
  const r = await env.DB.prepare(
    `SELECT n.id, n.user_id, n.time, n.timezone, n.message, n.next_fire_at,
            n.last_sent_at, n.created_at, u.chat_id AS chat_id
     FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.next_fire_at <= ? AND n.next_fire_at > ?`,
  )
    .bind(nowMs, nowMs - LOOKBACK_MS)
    .all<DueNotification>();
  return r.results;
}

// Single statement = atomic. Bumps next_fire_at to tomorrow's local instance.
export async function recordSent(
  env: Env,
  n: DueNotification,
  sentAtMs: number,
): Promise<void> {
  const next = computeNextFireAt(n.time, n.timezone, sentAtMs);
  await env.DB.prepare(
    `UPDATE notifications SET last_sent_at = ?, next_fire_at = ? WHERE id = ?`,
  )
    .bind(sentAtMs, next, n.id)
    .run();
}
