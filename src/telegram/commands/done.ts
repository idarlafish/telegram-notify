import type { AppBot } from "../bot";

// Pure acknowledgement — the daily next_fire_at was already advanced by the
// scheduler when the message was sent. Delete the reminder so the chat stays
// tidy; the next day's instance will arrive as a fresh message.
export function registerDone(bot: AppBot): void {
  bot.callbackQuery(/^done:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅" });
    try {
      await ctx.deleteMessage();
    } catch {
      // Message may be too old to delete (Telegram limit: 48h) — ignore.
    }
  });
}
