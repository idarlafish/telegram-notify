import { upsertUser } from "../../db/users";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

const WELCOME = "👋 Welcome to sleepy-notify";

export function registerStart(bot: AppBot, env: Env): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await upsertUser(env, ctx.from.id, ctx.chat.id);

    await ctx.reply(WELCOME, {
      reply_markup: {
        remove_keyboard: true
      },
    });
  });
}
