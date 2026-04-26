import { createBot } from "../telegram/bot";
import { findDueNotifications, recordSent, deleteById } from "../db/notifications";
import { logger } from "../lib/logger";
import type { Env } from "../env";

// Called by Cron Trigger every minute. Finds notifications whose next_fire_at
// has passed (within a 5-min lookback to recover missed firings) and sends them.
export async function fireDueNotifications(
  env: Env, nowMs: number = Date.now(),
): Promise<void> {
  const due = await findDueNotifications(env, nowMs);
  logger.info("cron tick", { due: due.length });
  if (due.length === 0) return;

  const bot = createBot(env);
  for (const n of due) {
    try {
      await bot.api.sendMessage(n.chat_id, n.message, {
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Done", callback_data: `done:${n.id}` }]],
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
