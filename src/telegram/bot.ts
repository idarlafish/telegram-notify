import { Bot } from "grammy";
import type { Env } from "../env";

export function createBot(env: Env) {
  return new Bot(env.BOT_TOKEN);
}

export type AppBot = ReturnType<typeof createBot>;
