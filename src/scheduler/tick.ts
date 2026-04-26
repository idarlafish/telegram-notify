import { createBot } from "../telegram/bot";
import {
  findDueNotifications,
  recordSent,
  deleteById,
  type DueNotification,
} from "../db/notifications";
import { logger } from "../lib/logger";
import type { Env } from "../env";

// 10 minutes — KV expires the key automatically, so /health/cron can treat
// "no value" as "stale" without doing age math itself. Comfortably > our
// 1-minute cron cadence so a single missed tick doesn't trip the alert.
const HEARTBEAT_TTL_SECONDS = 10 * 60;

// Called by Cron Trigger every minute. Finds notifications whose next_fire_at
// has passed (within a 5-min lookback to recover missed firings) and sends
// them, then writes a heartbeat so /health/cron knows we're alive.
export async function fireDueNotifications(
  env: Env, nowMs: number = Date.now(),
): Promise<void> {
  // If findDueNotifications throws (D1 hiccup), we WANT to skip the heartbeat
  // below — that's how /health/cron alerts on a broken DB connection. Don't
  // wrap this in try/catch.
  const due = await findDueNotifications(env, nowMs);
  logger.info("cron tick", { due: due.length });
  if (due.length > 0) await deliverDue(env, due, nowMs);

  // Heartbeat AFTER the work, not before — so a tick that crashes mid-deliver
  // doesn't falsely report "healthy" to the monitor.
  await env.CRON_STATE.put("last_cron_tick_at", String(nowMs), {
    expirationTtl: HEARTBEAT_TTL_SECONDS,
  });
}

async function deliverDue(env: Env, due: DueNotification[], nowMs: number): Promise<void> {
  const bot = createBot(env);
  for (const n of due) {
    try {
      await bot.api.sendMessage(n.chat_id, n.message, {
        reply_markup: {
          inline_keyboard: [[{ text: "✅", callback_data: `done:${n.id}` }]],
        },
      });
      if (n.kind === "one_time") {
        await deleteById(env, n.id);
        logger.info("one-time fired and deleted", { id: n.id, chat_id: n.chat_id });
      } else {
        await recordSent(env, n, nowMs);
        logger.info("recurring fired", { id: n.id, chat_id: n.chat_id });
      }
    } catch (err) {
      logger.error("notification send failed", { id: n.id, error: String(err) });
    }
  }
}
