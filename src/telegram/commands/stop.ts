import { deleteUser } from "../../db/users";
import { logger } from "../../lib/logger";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

const FAREWELL =
  "🧹 All your reminders and account data have been erased.\n\n" +
  "Send /start any time to begin again.";

export function registerStop(bot: AppBot, env: Env): void {
  bot.command("stop", async (ctx) => {
    if (!ctx.from) return;
    await deleteUser(env, ctx.from.id);
    logger.info("user stopped", { user_id: ctx.from.id });
    await ctx.reply(FAREWELL, {
      reply_markup: { remove_keyboard: true },
    });
    // Reset per-chat menu button override too.
    if (ctx.chat) {
      await ctx.api.setChatMenuButton({
        chat_id: ctx.chat.id,
        menu_button: { type: "default" },
      });
    }
  });
}
