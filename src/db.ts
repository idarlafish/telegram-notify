import type { Env, Notification, NotificationInput, User } from "./types.ts";
import { computeNextFireAt } from "./time.ts";

export async function upsertUser(env: Env, id: number, chatId: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, chat_id) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET chat_id = excluded.chat_id`,
  )
    .bind(id, chatId)
    .run();
}

export async function getUser(env: Env, id: number): Promise<User | null> {
  return env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<User>();
}

export async function listNotifications(env: Env, userId: number): Promise<Notification[]> {
  const r = await env.DB.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY time`,
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
  return (await env.DB.prepare(`SELECT * FROM notifications WHERE id = ?`)
    .bind(id)
    .first<Notification>())!;
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

// Find notifications due to fire. lookbackMs lets us catch ones missed by a
// previous cron firing (e.g., if the worker was briefly unavailable).
export async function findDueNotifications(
  env: Env,
  nowMs: number,
  lookbackMs: number = 5 * 60_000,
): Promise<Notification[]> {
  const r = await env.DB.prepare(
    `SELECT n.*, u.chat_id AS chat_id FROM notifications n
     JOIN users u ON u.id = n.user_id
     WHERE n.next_fire_at <= ? AND n.next_fire_at > ?`,
  )
    .bind(nowMs, nowMs - lookbackMs)
    .all<Notification & { chat_id: number }>();
  return r.results;
}

// Called after a successful send: bump next_fire_at to the next occurrence and
// record last_sent_at. Single statement = atomic.
export async function recordSent(
  env: Env,
  notification: Notification,
  sentAtMs: number,
): Promise<void> {
  const next = computeNextFireAt(notification.time, notification.timezone, sentAtMs);
  await env.DB.prepare(
    `UPDATE notifications SET last_sent_at = ?, next_fire_at = ? WHERE id = ?`,
  )
    .bind(sentAtMs, next, notification.id)
    .run();
}
