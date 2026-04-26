import { upsertUser } from "../../db/users";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

const WELCOME =
  "👋 Welcome to telegram-notify.\n\n" +
  "Open the Mini App to add daily reminders. " +
  "Each reminder fires once a day at your chosen local time.";

export function registerStart(bot: AppBot, env: Env): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await upsertUser(env, ctx.from.id, ctx.chat.id);
    await ctx.reply(WELCOME);
  });
}
