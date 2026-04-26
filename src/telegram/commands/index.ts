import { registerStart } from "./start";
import { registerStop } from "./stop";
import { registerDone } from "./done";
import type { AppBot } from "../bot";
import type { Env } from "../../env";

export function registerCommands(bot: AppBot, env: Env): void {
  registerStart(bot, env);
  registerStop(bot, env);
  registerDone(bot);
}
