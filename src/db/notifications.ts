import { and, eq, getTableColumns, gt, lte } from "drizzle-orm";
import { db } from "./client";
import { notifications, users, type Notification } from "./schema";
import { computeNextFireAt } from "../lib/time";
import type { Env } from "../env";

export type { Notification };

export interface NotificationInput {
  time: string;
  timezone: string;
  message: string;
}

export type DueNotification = Notification & { chat_id: number };

// Catch firings missed by a previous cron tick (worker briefly unavailable).
const LOOKBACK_MS = 5 * 60_000;

export async function listByUser(env: Env, userId: number): Promise<Notification[]> {
  return db(env)
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(notifications.time);
}

export async function createNotification(
  env: Env,
  userId: number,
  input: NotificationInput,
): Promise<Notification> {
  const id = crypto.randomUUID();
  const next = computeNextFireAt(input.time, input.timezone);
  const [row] = await db(env)
    .insert(notifications)
    .values({
      id,
      user_id: userId,
      time: input.time,
      timezone: input.timezone,
      message: input.message,
      next_fire_at: next,
    })
    .returning();
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function deleteNotification(
  env: Env,
  userId: number,
  id: string,
): Promise<boolean> {
  const result = await db(env)
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
  return (result.meta.changes ?? 0) > 0;
}

export async function findDueNotifications(
  env: Env,
  nowMs: number,
): Promise<DueNotification[]> {
  return db(env)
    .select({
      ...getTableColumns(notifications),
      chat_id: users.chat_id,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.user_id))
    .where(
      and(
        lte(notifications.next_fire_at, nowMs),
        gt(notifications.next_fire_at, nowMs - LOOKBACK_MS),
      ),
    );
}

// Single statement = atomic. Bumps next_fire_at to tomorrow's local instance.
export async function recordSent(
  env: Env,
  n: DueNotification,
  sentAtMs: number,
): Promise<void> {
  const next = computeNextFireAt(n.time, n.timezone, sentAtMs);
  await db(env)
    .update(notifications)
    .set({ last_sent_at: sentAtMs, next_fire_at: next })
    .where(eq(notifications.id, n.id));
}
