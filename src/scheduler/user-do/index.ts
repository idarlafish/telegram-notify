/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../../../drizzle/migrations/migrations";
import { notifications } from "./schema";
import { decryptMessage, encryptMessage } from "../../lib/crypto";
import { bitmaskToDays, daysToBitmask } from "./mappers";
import type { Env } from "../../env";
import { nextRecurring, oneTimeFireAt } from "./time";
import { sql, eq } from "drizzle-orm";
import type { Notification, NotificationInput, Profile, UpdateInput } from "./types";

type Schema = { notifications: typeof notifications };

export class UserSchedulerDO extends DurableObject<Env> {
  storage: DurableObjectStorage;
  db: DrizzleSqliteDODatabase<Schema>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.db = drizzle(this.storage, { logger: false, schema: { notifications } });

    ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, migrations);
    });
  }

  async bind(chatId: number): Promise<void> {
    const existing = await this.storage.get<Profile>("profile");
    await this.storage.put<Profile>("profile", {
      chat_id: chatId,
      created_at: existing?.created_at ?? Date.now(),
    });
  }

  async profile(): Promise<Profile | null> {
    return (await this.storage.get<Profile>("profile")) ?? null;
  }

  async destroy(): Promise<void> {
    await this.storage.deleteAll();
    await this.storage.deleteAlarm();
  }

  async list(): Promise<Notification[]> {
    const rows = await this.db.select().from(notifications).orderBy(notifications.time);
    return Promise.all(rows.map((r) => this.toApi(r)));
  }

  async create(input: NotificationInput): Promise<Notification> {
    const id = crypto.randomUUID();
    const nextFireAt = input.kind === "recurring"
      ? nextRecurring(input.time, input.timezone, daysToBitmask(input.days))
      : oneTimeFireAt(input.date, input.time, input.timezone);
    const ciphertext = await encryptMessage(this.env, input.message);

    await this.db.insert(notifications).values({
      id,
      message: ciphertext,
      time: input.time,
      timezone: input.timezone,
      kind: input.kind,
      weekdays: input.kind === "recurring" ? daysToBitmask(input.days) : null,
      next_fire_at: nextFireAt,
    });

    await this.refreshAlarm();

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

  async update(id: string, patch: UpdateInput): Promise<Notification | null> {
    const [cur] = await this.db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!cur) return null;

    const currentMessage = await decryptMessage(this.env, cur.message);
    const merged = (cur.kind === "recurring"
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
          date: patch.date ?? new Intl.DateTimeFormat("en-CA", {
            timeZone: cur.timezone, year: "numeric", month: "2-digit", day: "2-digit",
          }).format(new Date(cur.next_fire_at)),
        }) satisfies NotificationInput;

    const recompute =
      patch.time !== undefined || patch.timezone !== undefined ||
      patch.days !== undefined || patch.date !== undefined;

    const updateValues: Record<string, unknown> = {
      time: merged.time,
      timezone: merged.timezone,
      message: await encryptMessage(this.env, merged.message),
    };
    if (merged.kind === "recurring") updateValues.weekdays = daysToBitmask(merged.days);
    if (recompute) {
      updateValues.next_fire_at = merged.kind === "recurring"
        ? nextRecurring(merged.time, merged.timezone, daysToBitmask(merged.days))
        : oneTimeFireAt(merged.date, merged.time, merged.timezone);
    }

    const [updated] = await this.db
      .update(notifications)
      .set(updateValues)
      .where(eq(notifications.id, id))
      .returning();

    if (!updated) return null;
    await this.refreshAlarm();
    return this.toApi(updated);
  }

  private async refreshAlarm(): Promise<void> {
    const [row] = await this.db
      .select({ min: sql<number | null>`MIN(${notifications.next_fire_at})` })
      .from(notifications);
    if (row?.min == null) {
      await this.storage.deleteAlarm();
    } else {
      await this.storage.setAlarm(row.min);
    }
  }

  private async toApi(r: typeof notifications.$inferSelect): Promise<Notification> {
    const message = await decryptMessage(this.env, r.message);
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
}
