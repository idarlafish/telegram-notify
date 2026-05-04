/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../../../migrations/migrations";
import { notifications } from "./schema";
import { bindProfile, destroyProfile, getProfile } from "./profile";
import {
  createNotification,
  deleteNotification,
  listNotifications,
  updateNotification,
} from "./crud";
import { fireAndAdvance } from "./alarm";
import { logger } from "../../lib/logger";
import type { Env } from "../../env";
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

  // Profile ops — touch only KV-style storage.
  bind(chatId: number): Promise<void> {
    return bindProfile(this.storage, chatId);
  }
  profile(): Promise<Profile | null> {
    return getProfile(this.storage);
  }
  destroy(): Promise<void> {
    return destroyProfile(this.storage);
  }

  // Notification CRUD — touch SQLite + storage (alarm refresh).
  list(): Promise<Notification[]> {
    return listNotifications(this.deps());
  }
  create(input: NotificationInput): Promise<Notification> {
    return createNotification(this.deps(), input);
  }
  update(id: string, patch: UpdateInput): Promise<Notification | null> {
    return updateNotification(this.deps(), id, patch);
  }
  delete(id: string): Promise<boolean> {
    return deleteNotification(this.deps(), id);
  }

  // Alarm — fires due rows, advances state, reschedules.
  // Wraps fireAndAdvance in unbounded retry (CF auto-retries 6 times only).
  async alarm(): Promise<void> {
    try {
      await fireAndAdvance(this.deps());
    } catch (err) {
      logger.error("alarm error", { error: String(err) });
      await this.storage.setAlarm(Date.now() + 60_000);
    }
  }

  private deps() {
    return { db: this.db, storage: this.storage, env: this.env };
  }
}
