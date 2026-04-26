import type { AppBot } from "../bot";

// Pure acknowledgement — the daily next_fire_at was already advanced by the
// scheduler when the message was sent. Edit the message so the user sees the
// tap took effect.
export function registerDone(bot: AppBot): void {
  bot.callbackQuery(/^done:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "✅ Done" });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      // Message may be too old to edit — ignore.
    }
  });
}
