/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../../../drizzle/migrations/migrations";
import { notifications } from "./schema";
import { decryptMessage } from "../../lib/crypto";
import { bitmaskToDays } from "./mappers";
import type { Env } from "../../env";
import type { Notification, Profile } from "./types";

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
