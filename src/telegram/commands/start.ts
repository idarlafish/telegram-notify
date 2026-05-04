import { userDoStub } from "../../scheduler/user-do/stub";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

const WELCOME = "👋 Welcome to sleepy-notify";

export function registerStart(bot: AppBot, env: Env): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await userDoStub(env, ctx.from.id).bind(ctx.chat.id);

    await ctx.api.setChatMenuButton({
      chat_id: ctx.chat.id,
      menu_button: { type: "default" },
    });
    await ctx.reply(WELCOME, { reply_markup: { remove_keyboard: true } });
  });
}
