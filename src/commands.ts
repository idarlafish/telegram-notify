import type { AppBot } from "./bot.ts";
import { upsertUser } from "./db.ts";
import type { Env } from "./types.ts";

export function registerCommands(bot: AppBot, env: Env): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    await upsertUser(env, ctx.from.id, ctx.chat.id);
    await ctx.reply(
      "👋 Welcome to telegram-notify.\n\n" +
        "Open the Mini App to add daily reminders. " +
        "Each reminder fires once a day at your chosen local time.",
    );
  });

  bot.callbackQuery(/^done:/, async (ctx) => {
    // Pure acknowledgement — the daily lastSentAt was already recorded when
    // the message was sent. Edit the message so the user sees it took effect.
    await ctx.answerCallbackQuery({ text: "✅ Done" });
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      // Ignore — message may be too old to edit.
    }
  });
}
