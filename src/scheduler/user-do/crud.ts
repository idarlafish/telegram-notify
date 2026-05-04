import { eq } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { notifications } from "./schema";
import { decryptMessage, encryptMessage } from "../../lib/crypto";
import { bitmaskToDays, daysToBitmask } from "./mappers";
import { nextRecurring, oneTimeFireAt } from "./time";
import { refreshAlarm } from "./refresh-alarm";
import type { Notification, NotificationInput, UpdateInput } from "./types";
import type { Env } from "../../env";

type Schema = { notifications: typeof notifications };
type Row = typeof notifications.$inferSelect;
type NotificationUpdate = {
  time: string;
  timezone: string;
  message: string;
  weekdays?: number | null;
  next_fire_at?: number;
};

export type Ctx = {
  db: DrizzleSqliteDODatabase<Schema>;
  storage: DurableObjectStorage;
  env: Env;
};

export async function listNotifications(ctx: Ctx): Promise<Notification[]> {
  const rows = await ctx.db.select().from(notifications).orderBy(notifications.time);
  return Promise.all(rows.map((r) => toApi(ctx.env, r)));
}

export async function createNotification(
  ctx: Ctx,
  input: NotificationInput,
): Promise<Notification> {
  const id = crypto.randomUUID();
  const nextFireAt =
    input.kind === "recurring"
      ? nextRecurring(input.time, input.timezone, daysToBitmask(input.days))
      : oneTimeFireAt(input.date, input.time, input.timezone);
  const ciphertext = await encryptMessage(ctx.env, input.message);

  await ctx.db.insert(notifications).values({
    id,
    message: ciphertext,
    time: input.time,
    timezone: input.timezone,
    kind: input.kind,
    weekdays: input.kind === "recurring" ? daysToBitmask(input.days) : null,
    next_fire_at: nextFireAt,
  });

  await refreshAlarm(ctx.db, ctx.storage);

  const base: Notification = {
    id,
    kind: input.kind,
    time: input.time,
    timezone: input.timezone,
    message: input.message,
    next_fire_at: nextFireAt,
    last_sent_at: null,
    created_at: Date.now(),
  };
  if (input.kind === "recurring") base.days = input.days;
  return base;
}

export async function updateNotification(
  ctx: Ctx,
  id: string,
  patch: UpdateInput,
): Promise<Notification | null> {
  const [cur] = await ctx.db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!cur) return null;

  const currentMessage = await decryptMessage(ctx.env, cur.message);
  const merged = (
    cur.kind === "recurring"
      ? {
          kind: "recurring" as const,
          time: patch.time ?? cur.time,
          timezone: patch.timezone ?? cur.timezone,
          message: patch.message ?? currentMessage,
          days: patch.days ?? bitmaskToDays(cur.weekdays!),
        }
      : {
          kind: "one_time" as const,
          time: patch.time ?? cur.time,
          timezone: patch.timezone ?? cur.timezone,
          message: patch.message ?? currentMessage,
          date:
            patch.date ??
            new Intl.DateTimeFormat("en-CA", {
              timeZone: cur.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(cur.next_fire_at)),
        }
  ) satisfies NotificationInput;

  const recompute =
    patch.time !== undefined ||
    patch.timezone !== undefined ||
    patch.days !== undefined ||
    patch.date !== undefined;

  const updateValues: NotificationUpdate = {
    time: merged.time,
    timezone: merged.timezone,
    message: await encryptMessage(ctx.env, merged.message),
  };
  if (merged.kind === "recurring") updateValues.weekdays = daysToBitmask(merged.days);
  if (recompute) {
    updateValues.next_fire_at =
      merged.kind === "recurring"
        ? nextRecurring(merged.time, merged.timezone, daysToBitmask(merged.days))
        : oneTimeFireAt(merged.date, merged.time, merged.timezone);
  }

  const [updated] = await ctx.db
    .update(notifications)
    .set(updateValues)
    .where(eq(notifications.id, id))
    .returning();

  if (!updated) return null;
  await refreshAlarm(ctx.db, ctx.storage);
  return toApi(ctx.env, updated);
}

export async function deleteNotification(ctx: Ctx, id: string): Promise<boolean> {
  const [exists] = await ctx.db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);
  if (!exists) return false;
  await ctx.db.delete(notifications).where(eq(notifications.id, id));
  await refreshAlarm(ctx.db, ctx.storage);
  return true;
}

async function toApi(env: Env, r: Row): Promise<Notification> {
  const message = await decryptMessage(env, r.message);
  const base = {
    id: r.id,
    kind: r.kind,
    time: r.time,
    timezone: r.timezone,
    message,
    next_fire_at: r.next_fire_at,
    last_sent_at: r.last_sent_at,
    created_at: r.created_at,
  } as Notification;
  if (r.kind === "recurring") base.days = bitmaskToDays(r.weekdays!);
  return base;
}
