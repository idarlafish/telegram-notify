import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import type { Env } from "../env";

export function createBot(env: Env) {
  const bot = new Bot(env.BOT_TOKEN);
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));
  return bot;
}

export type AppBot = ReturnType<typeof createBot>;
