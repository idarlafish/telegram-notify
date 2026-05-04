import type { CommandGroup } from "@grammyjs/commands";
import type { Context } from "grammy";
import { destroyUser } from "../../services/user";
import { logger } from "../../lib/logger";
import type { Env } from "../../env";

const FAREWELL =
  "🧹 All your reminders and account data have been erased.\n\n" +
  "Send /start any time to begin again.";

export function registerStop(commands: CommandGroup<Context>, env: Env): void {
  commands.command("stop", "Erase all your reminders and account data", async (ctx) => {
    if (!ctx.from) return;
    await destroyUser(env, ctx.from.id);
    logger.info("user stopped", { user_id: ctx.from.id });

    await ctx.reply(FAREWELL, { reply_markup: { remove_keyboard: true } });
    if (ctx.chat) {
      await ctx.api.setChatMenuButton({
        chat_id: ctx.chat.id,
        menu_button: { type: "default" },
      });
    }
  });
}
