import { createBot } from "../telegram/bot";
import {
  findDueNotifications,
  recordSent,
  deleteById,
  type DueNotification,
} from "../db/notifications";
import { logger } from "../lib/logger";
import type { Env } from "../env";

// 10 minutes — KV expires the key automatically, so /health/cron treats
// "no value" as stale without doing age math itself.
const HEARTBEAT_TTL_SECONDS = 10 * 60;

// Called by the Cron Trigger every minute. Composes the work + the heartbeat
// so each function does exactly one thing and the orchestration is visible
// at the top level. If `fireDueNotifications` throws (D1 hiccup), we WANT
// the heartbeat to be skipped — that's how /health/cron alerts on a broken
// DB connection.
export async function runCronTick(env: Env, nowMs: number = Date.now()): Promise<void> {
  await fireDueNotifications(env, nowMs);
  await heartbeat(env, nowMs);
}

async function fireDueNotifications(env: Env, nowMs: number): Promise<void> {
  const due = await findDueNotifications(env, nowMs);
  logger.info("cron tick", { due: due.length });
  if (due.length === 0) return;

  const bot = createBot(env);
  for (const n of due) {
    try {
      await bot.api.sendMessage(n.chat_id, n.message, {
        reply_markup: {
          inline_keyboard: [[{ text: "✅", callback_data: `done:${n.id}` }]],
        },
      });
      await postFire(env, n, nowMs);
    } catch (err) {
      logger.error("notification send failed", { id: n.id, error: String(err) });
    }
  }
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
  await env.CRON_STATE.put("last_cron_tick_at", String(nowMs), {
    expirationTtl: HEARTBEAT_TTL_SECONDS,
  });
}
