import { createBot } from "../telegram/bot";
import {
  findDueNotifications,
  recordSent,
  deleteById,
  type DueNotification,
} from "../db/notifications";
import { logger } from "../lib/logger";
import type { Env } from "../env";

// Heartbeat is throttled to one KV write per HEARTBEAT_INTERVAL_MINUTES to
// stay under the KV free-tier write quota (1k/day). TTL must comfortably
// exceed the interval so a single missed write doesn't trip the alert; it
// must also exceed the external probe alert window (see tools repo monitoring
// config) so the value is always present during normal operation.
const HEARTBEAT_INTERVAL_MINUTES = 5;
const HEARTBEAT_TTL_SECONDS = 15 * 60;

// Uncaught read failures skip the heartbeat — that's the D1-down alarm.
export async function runCronTick(env: Env, nowMs: number = Date.now()): Promise<void> {
  const tickStart = Date.now();
  await fireDueNotifications(env, nowMs);
  await heartbeat(env, nowMs);
  logger.event(env, "cron_tick", { duration_ms: Date.now() - tickStart });
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
      });
    }
  } catch (err) {
    outcome = "db_error";
    logger.error("postFire failed", { id: n.id, error: String(err) });
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
    await deleteById(env, n.id);
    logger.info("one-time fired and deleted", { id: n.id, chat_id: n.chat_id });
  } else {
    await recordSent(env, n, nowMs);
    logger.info("recurring fired", { id: n.id, chat_id: n.chat_id });
  }
}

async function heartbeat(env: Env, nowMs: number): Promise<void> {
  // Write only on minute boundaries divisible by HEARTBEAT_INTERVAL_MINUTES.
  // Deterministic from nowMs alone — no extra KV read needed.
  const minutesSinceEpoch = Math.floor(nowMs / 60_000);
  if (minutesSinceEpoch % HEARTBEAT_INTERVAL_MINUTES !== 0) return;
  await env.CRON_STATE.put("last_cron_tick_at", String(nowMs), {
    expirationTtl: HEARTBEAT_TTL_SECONDS,
  });
}
