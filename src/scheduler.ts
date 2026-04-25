import { createBot } from "./bot.ts";
import { findDueNotifications, recordSent } from "./db.ts";
import type { Env } from "./types.ts";

// Called by Cron Trigger every minute. Finds notifications whose next_fire_at
// has passed (within a 5-min lookback to recover missed firings) and sends them.
export async function fireDueNotifications(env: Env, nowMs: number = Date.now()): Promise<void> {
  const due = await findDueNotifications(env, nowMs);
  if (due.length === 0) return;

  const bot = createBot(env);
  for (const n of due) {
    try {
      await bot.api.sendMessage(n.chat_id, n.message, {
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Done", callback_data: `done:${n.id}` }]],
        },
      });
      await recordSent(env, n, nowMs);
      console.log(`sent ${n.id} to ${n.chat_id}`);
    } catch (err) {
      console.error(`failed ${n.id}:`, err);
      // Don't recordSent — let the next minute's cron retry.
    }
  }
}
