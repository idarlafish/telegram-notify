import { CommandGroup } from "@grammyjs/commands";
import { registerStart } from "./start";
import { registerStop } from "./stop";
import { registerDone } from "./done";
import { logger } from "../../lib/logger";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

let commandsSyncedInThisIsolate = false;

export function registerCommands(bot: AppBot, env: Env): void {
  const commands = new CommandGroup();
  registerStart(commands, env);
  registerStop(commands, env);
  bot.use(commands);
  registerDone(bot);

  if (!commandsSyncedInThisIsolate) {
    commandsSyncedInThisIsolate = true;
    void commands.setCommands(bot).catch((err) => {
      commandsSyncedInThisIsolate = false;
      logger.error("setCommands sync failed", { error: String(err) });
    });
  }
}
