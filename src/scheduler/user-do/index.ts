/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../../../drizzle/migrations/migrations";
import { notifications } from "./schema";
import type { Env } from "../../env";
import type { Profile } from "./types";

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
}
