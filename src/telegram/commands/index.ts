import { registerStart } from "./start";
import { registerDone } from "./done";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

export function registerCommands(bot: AppBot, env: Env): void {
  registerStart(bot, env);
  registerDone(bot);
}
