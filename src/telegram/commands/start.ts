import type { CommandGroup } from "@grammyjs/commands";
import type { Context } from "grammy";
import { bindUser } from "../../services/user";
import type { Env } from "../../env";

const WELCOME = "👋 Welcome to sleepy-notify";

export function registerStart(commands: CommandGroup<Context>, env: Env): void {
  commands.command("start", "Begin or refresh your session", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await bindUser(env, ctx.from.id, ctx.chat.id);

    await ctx.api.setChatMenuButton({
      chat_id: ctx.chat.id,
      menu_button: { type: "default" },
    });
    await ctx.reply(WELCOME, { reply_markup: { remove_keyboard: true } });
  });
}
