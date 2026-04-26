import { and, eq, getTableColumns, gt, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { notifications, users, type Notification } from "./schema";
import { daysToBitmask, bitmaskToDays, type WeekDay } from "./mappers";
import { nextRecurring, oneTimeFireAt } from "../lib/time";
import { encryptMessage, decryptMessage } from "../lib/crypto";
import { ConflictError } from "../lib/errors";
import type { Env } from "../env";

export const MAX_NOTIFICATIONS_PER_USER = 50;

export type { Notification, WeekDay };

export type NotificationRow = Omit<Notification, "weekdays"> & { days?: WeekDay[] };

export type RecurringInput = {
  kind: "recurring"; time: string; timezone: string; message: string; days: WeekDay[];
};
export type OneTimeInput = {
  kind: "one_time"; time: string; timezone: string; message: string; date: string;
};
export type NotificationInput = RecurringInput | OneTimeInput;

export type DueNotification = Notification & { chat_id: number };

const LOOKBACK_MS = 5 * 60_000;

async function rowToApi(env: Env, n: Notification): Promise<NotificationRow> {
  const { weekdays, message, ...rest } = n;
  const decryptedMessage = await decryptMessage(env, message);
  const base = { ...rest, message: decryptedMessage };
  if (n.kind === "recurring") return { ...base, days: bitmaskToDays(weekdays!) };
  return base;
}

function computeNextFire(input: NotificationInput): number {
  if (input.kind === "recurring") {
    return nextRecurring(input.time, input.timezone, daysToBitmask(input.days));
  }
  return oneTimeFireAt(input.date, input.time, input.timezone);
}

export async function listByUser(env: Env, userId: number): Promise<NotificationRow[]> {
  const rows = await db(env)
    .select().from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(notifications.time);
  return Promise.all(rows.map((r) => rowToApi(env, r)));
}

export async function createNotification(
  env: Env, userId: number, input: NotificationInput,
): Promise<NotificationRow> {
  const [c] = await db(env)
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.user_id, userId));
  if ((c?.count ?? 0) >= MAX_NOTIFICATIONS_PER_USER) {
    throw new ConflictError(`reminder limit (${MAX_NOTIFICATIONS_PER_USER}) reached`);
  }
  const id = crypto.randomUUID();
  const next = computeNextFire(input);
  const encryptedMessage = await encryptMessage(env, input.message);
  const [row] = await db(env).insert(notifications).values({
    id, user_id: userId, message: encryptedMessage,
    time: input.time, timezone: input.timezone,
    kind: input.kind,
    weekdays: input.kind === "recurring" ? daysToBitmask(input.days) : null,
    next_fire_at: next,
  }).returning();
  if (!row) throw new Error("insert returned no row");
  return rowToApi(env, row);
}

export type UpdateInput = Partial<{
  time: string; timezone: string; message: string;
  days: WeekDay[]; date: string;
}>;

export async function updateNotification(
  env: Env, userId: number, id: string, patch: UpdateInput,
): Promise<NotificationRow | null> {
  const [cur] = await db(env)
    .select().from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))
    .limit(1);
  if (!cur) return null;

  const currentMessage = await decryptMessage(env, cur.message);

  const merged: NotificationInput = cur.kind === "recurring"
    ? {
        kind: "recurring",
        time: patch.time ?? cur.time,
        timezone: patch.timezone ?? cur.timezone,
        message: patch.message ?? currentMessage,
        days: patch.days ?? bitmaskToDays(cur.weekdays!),
      }
    : {
        kind: "one_time",
        time: patch.time ?? cur.time,
        timezone: patch.timezone ?? cur.timezone,
        message: patch.message ?? currentMessage,
        date: patch.date ?? new Intl.DateTimeFormat("en-CA", {
          timeZone: cur.timezone, year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(cur.next_fire_at)),
      };

  const recompute =
    patch.time !== undefined || patch.timezone !== undefined ||
    patch.days !== undefined || patch.date !== undefined;

  const update: Record<string, unknown> = {
    time: merged.time, timezone: merged.timezone,
    message: await encryptMessage(env, merged.message),
  };
  if (merged.kind === "recurring") update.weekdays = daysToBitmask(merged.days);
  if (recompute) update.next_fire_at = computeNextFire(merged);

  const [updated] = await db(env)
    .update(notifications).set(update)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)))
    .returning();
  return updated ? rowToApi(env, updated) : null;
}

export async function deleteNotification(
  env: Env, userId: number, id: string,
): Promise<boolean> {
  const result = await db(env)
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.user_id, userId)));
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteById(env: Env, id: string): Promise<void> {
  await db(env).delete(notifications).where(eq(notifications.id, id));
}

export async function findDueNotifications(
  env: Env, nowMs: number,
): Promise<DueNotification[]> {
  const rows = await db(env)
    .select({ ...getTableColumns(notifications), chat_id: users.chat_id })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.user_id))
    .where(and(
      lte(notifications.next_fire_at, nowMs),
      gt(notifications.next_fire_at, nowMs - LOOKBACK_MS),
    ));
  return Promise.all(
    rows.map(async (r) => ({ ...r, message: await decryptMessage(env, r.message) })),
  );
}

export async function recordSent(
  env: Env, n: DueNotification, sentAtMs: number,
): Promise<void> {
  // Caller branches on kind; this is recurring-only.
  const next = nextRecurring(n.time, n.timezone, n.weekdays!, sentAtMs);
  await db(env).update(notifications)
    .set({ last_sent_at: sentAtMs, next_fire_at: next })
    .where(eq(notifications.id, n.id));
}
