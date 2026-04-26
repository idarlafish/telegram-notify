import { Bot } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import type { Env } from "../env";

export function createBot(env: Env) {
  const bot = new Bot(env.BOT_TOKEN);
  // Honor Telegram's `retry_after` on 429 and retry transient 5xx so
  // a single tick can absorb a brief Telegram hiccup without losing a
  // notification. Capped so we never block a cron minute longer than the
  // tick budget allows.
  bot.api.config.use(
    autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }),
  );
  return bot;
}

export type AppBot = ReturnType<typeof createBot>;
