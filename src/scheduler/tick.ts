import { createBot } from "../telegram/bot";
import {
  findDueNotifications,
  recordSent,
  deleteById,
  type DueNotification,
} from "../db/notifications";
import { logger } from "../lib/logger";
import type { Env } from "../env";

// KV heartbeat is throttled by reading the previous timestamp first and
// skipping the write if the gap is < HEARTBEAT_INTERVAL_MS. Self-healing: a
// missed write is retried on the very next tick. TTL is ~3× the interval so a
// transient KV outage doesn't trip the alert, and must exceed the external
// probe alert window (see tools repo monitoring config) so the value is
// always present during normal operation.
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;
const HEARTBEAT_TTL_SECONDS = 15 * 60;

// Uncaught read failures skip the heartbeat — that's the D1-down alarm.
// `scheduledTimeMs` is the cron's intended dispatch instant (from
// ScheduledController.scheduledTime). When supplied we emit dispatch_lag_ms
// so we can see Cloudflare cron jitter on every tick.
export async function runCronTick(
  env: Env,
  nowMs: number = Date.now(),
  scheduledTimeMs?: number,
): Promise<void> {
  const tickStart = Date.now();
  await fireDueNotifications(env, nowMs);
  await heartbeat(env, nowMs);
  const fields: Record<string, number> = { duration_ms: Date.now() - tickStart };
  if (scheduledTimeMs !== undefined) fields.dispatch_lag_ms = nowMs - scheduledTimeMs;
  logger.event(env, "cron_tick", fields);
}

async function fireDueNotifications(env: Env, nowMs: number): Promise<void> {
  const due = await findDueNotifications(env, nowMs);
  logger.info("cron tick", { due: due.length });
  if (due.length === 0) return;

  const bot = createBot(env);
  await Promise.all(due.map((n) => fireOne(env, bot, n, nowMs)));
}

async function fireOne(
  env: Env,
  bot: ReturnType<typeof createBot>,
  n: DueNotification,
  nowMs: number,
): Promise<void> {
  // postFire BEFORE send → at-most-once on crash between Telegram-accept and DB.
  const start = Date.now();
  let outcome: "ok" | "db_error" | "telegram_error" = "ok";
  try {
    await postFire(env, n, nowMs);
    try {
      await bot.api.sendMessage(n.chat_id, n.message, {
        reply_markup: {
          inline_keyboard: [[{ text: "✅", callback_data: `done:${n.id}` }]],
        },
      });
    } catch (err) {
      outcome = "telegram_error";
      logger.error("notification send failed (state already advanced)", {
        id: n.id,
        error: String(err),
        cause: err instanceof Error && err.cause !== undefined ? String(err.cause) : undefined,
      });
    }
  } catch (err) {
    outcome = "db_error";
    logger.error("postFire failed", {
      id: n.id,
      error: String(err),
      cause: err instanceof Error && err.cause !== undefined ? String(err.cause) : undefined,
    });
  }
  logger.event(env, "fire_one", {
    id: n.id,
    kind: n.kind,
    outcome,
    duration_ms: Date.now() - start,
  });
}

async function postFire(env: Env, n: DueNotification, nowMs: number): Promise<void> {
  if (n.kind === "one_time") {
    await withRetry(() => deleteById(env, n.id));
    logger.info("one-time fired and deleted", { id: n.id, chat_id: n.chat_id });
  } else {
    await withRetry(() => recordSent(env, n, nowMs));
    logger.info("recurring fired", { id: n.id, chat_id: n.chat_id });
  }
}

async function withRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      return await op();
    } catch (second) {
      if (second instanceof Error) (second as Error).cause = first;
      throw second;
    }
  }
}

async function heartbeat(env: Env, nowMs: number): Promise<void> {
  // Read first; skip the write if KV already holds a recent value. Strict
  // `<` against the interval ensures the steady-state write cadence cannot
  // be tighter than HEARTBEAT_INTERVAL_MS — caps writes at 288/day.
  const lastRaw = await env.CRON_STATE.get("last_cron_tick_at");
  const lastMs = lastRaw === null ? 0 : Number(lastRaw);
  if (Number.isFinite(lastMs) && nowMs - lastMs < HEARTBEAT_INTERVAL_MS) return;
  await env.CRON_STATE.put("last_cron_tick_at", String(nowMs), {
    expirationTtl: HEARTBEAT_TTL_SECONDS,
  });
}
