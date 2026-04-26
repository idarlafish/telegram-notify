import { upsertUser } from "../../db/users";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

const WELCOME = "👋 Welcome to sleepy-notify";

export function registerStart(bot: AppBot, env: Env): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await upsertUser(env, ctx.from.id, ctx.chat.id);

    // Clear any per-chat menu-button override left by the old sleepy-notify
    // backend (it set type=web_app pointing at ngrok per chat). Resetting to
    // "default" makes the menu fall back to the bot-wide setting (commands).
    await ctx.api.setChatMenuButton({
      chat_id: ctx.chat.id,
      menu_button: { type: "default" },
    });

    await ctx.reply(WELCOME, {
      reply_markup: { remove_keyboard: true },
    });
  });
}
