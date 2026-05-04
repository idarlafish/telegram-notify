import { and, eq, gt, lte } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { notifications } from "./schema";
import { decryptMessage } from "../../lib/crypto";
import { nextRecurring } from "./time";
import { refreshAlarm } from "./refresh-alarm";
import { getProfile } from "./profile";
import { is429, parseRetryAfter, sendNotification } from "./delivery";
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
  const due = await ctx.db
    .select()
    .from(notifications)
    .where(
      and(lte(notifications.next_fire_at, now), gt(notifications.next_fire_at, now - LOOKBACK_MS)),
    );

  if (due.length === 0) {
    await refreshAlarm(ctx.db, ctx.storage);
    return;
  }

  const outcomes = await Promise.all(
    due.map(async (n) => {
      try {
        await sendNotification(
          ctx.env,
          profile.chat_id,
          await decryptMessage(ctx.env, n.message),
          n.id,
        );
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
        logger.event(ctx.env, "alarm_fire", { id: n.id, kind: n.kind, outcome: "ok" });
        return { kind: "ok" as const };
      } catch (err) {
        if (is429(err)) {
          const retryAfterMs = parseRetryAfter(err) * 1000;
          logger.event(ctx.env, "alarm_fire", {
            id: n.id,
            kind: n.kind,
            outcome: "rate_limited",
          });
          return { kind: "rate_limited" as const, retryAfterMs };
        }

        logger.event(ctx.env, "alarm_fire", {
          id: n.id,
          kind: n.kind,
          outcome: "error",
          error: String(err),
        });
        return { kind: "error" as const };
      }
    }),
  );

  const maxRetryAfterMs = outcomes.reduce<number>(
    (max, outcome) =>
      outcome.kind === "rate_limited" ? Math.max(max, outcome.retryAfterMs) : max,
    0,
  );
  const hasError = outcomes.some((outcome) => outcome.kind === "error");

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
