import { eq, lte } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { notifications } from "./schema";
import { decryptMessage } from "../../lib/crypto";
import { nextRecurring } from "./time";
import { refreshAlarm } from "./refresh-alarm";
import { destroyProfile, getProfile } from "./profile";
import { deliver, type DeliveryOutcome } from "./delivery";
import { logger } from "../../lib/logger";
import type { Env } from "../../env";

type Schema = { notifications: typeof notifications };

export type AlarmCtx = {
  db: DrizzleSqliteDODatabase<Schema>;
  storage: DurableObjectStorage;
  env: Env;
};

const LOOKBACK_MS = 5 * 60_000;
const FALLBACK_RETRY_MS = 60_000;

export async function fireAndAdvance(ctx: AlarmCtx): Promise<void> {
  const profile = await getProfile(ctx.storage);
  if (!profile) return;

  const now = Date.now();
  const pastDue = await ctx.db
    .select()
    .from(notifications)
    .where(lte(notifications.next_fire_at, now));

  const stale = pastDue.filter((n) => n.next_fire_at <= now - LOOKBACK_MS);
  const due = pastDue.filter((n) => n.next_fire_at > now - LOOKBACK_MS);

  for (const n of stale) {
    if (n.kind === "one_time") {
      await ctx.db.delete(notifications).where(eq(notifications.id, n.id));
    } else {
      await ctx.db
        .update(notifications)
        .set({ next_fire_at: nextRecurring(n.time, n.timezone, n.weekdays!, now) })
        .where(eq(notifications.id, n.id));
    }
    logger.event(ctx.env, "alarm_skip", { id: n.id, kind: n.kind });
  }

  if (due.length === 0) {
    await refreshAlarm(ctx.db, ctx.storage);
    return;
  }

  const outcomes = await Promise.all(
    due.map(async (n) => {
      let outcome: DeliveryOutcome;
      try {
        const text = await decryptMessage(ctx.env, n.message);
        outcome = await deliver(ctx.env, profile.chat_id, text, n.id);
        if (outcome.kind === "ok") {
          if (n.kind === "one_time") {
            await ctx.db.delete(notifications).where(eq(notifications.id, n.id));
          } else {
            await ctx.db
              .update(notifications)
              .set({
                last_sent_at: now,
                next_fire_at: nextRecurring(n.time, n.timezone, n.weekdays!, now),
              })
              .where(eq(notifications.id, n.id));
          }
        }
      } catch (err) {
        outcome = { kind: "transient", error: String(err) };
      }
      const fields: Record<string, unknown> = { id: n.id, kind: n.kind, outcome: outcome.kind };
      if (outcome.kind === "transient") fields.error = outcome.error;
      if (outcome.kind === "unreachable") fields.reason = outcome.reason;
      logger.event(ctx.env, "alarm_fire", fields);
      return outcome;
    }),
  );

  if (outcomes.some((outcome) => outcome.kind === "unreachable")) {
    await ctx.db.delete(notifications);
    await destroyProfile(ctx.storage);
    return;
  }

  const maxRetryAfterMs = outcomes.reduce<number>(
    (max, outcome) => (outcome.kind === "rate_limited" ? Math.max(max, outcome.retryAfterMs) : max),
    0,
  );
  const hasError = outcomes.some((outcome) => outcome.kind === "transient");

  if (hasError) {
    await ctx.storage.setAlarm(Date.now() + Math.max(maxRetryAfterMs, FALLBACK_RETRY_MS));
    return;
  }

  if (maxRetryAfterMs > 0) {
    await ctx.storage.setAlarm(Date.now() + maxRetryAfterMs);
    return;
  }

  await refreshAlarm(ctx.db, ctx.storage);
}
