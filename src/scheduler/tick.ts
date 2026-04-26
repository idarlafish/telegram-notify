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
  // Fan out: one row's slow Telegram call no longer blocks the rest of the
  // batch. Telegram's global limit is ~30 msg/s and per-chat ~1 msg/s — at our
  // current row counts neither bites; auto-retry handles 429s if either does.
  await Promise.all(due.map((n) => fireOne(env, bot, n, nowMs)));
}

async function fireOne(
  env: Env,
  bot: ReturnType<typeof createBot>,
  n: DueNotification,
  nowMs: number,
): Promise<void> {
  // At-most-once: advance state BEFORE the Telegram call. If the isolate
  // dies after Telegram accepts but before recordSent/deleteById, the next
  // tick would otherwise resend — duplicate reminders are worse than a
  // missed one. Transient Telegram failures are handled by the grammY
  // auto-retry transformer (see telegram/bot.ts), not by lookback.
  await postFire(env, n, nowMs);
  try {
    await bot.api.sendMessage(n.chat_id, n.message, {
      reply_markup: {
        inline_keyboard: [[{ text: "✅", callback_data: `done:${n.id}` }]],
      },
    });
  } catch (err) {
    logger.error("notification send failed (state already advanced)", {
      id: n.id,
      error: String(err),
    });
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
