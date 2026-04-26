import { webhookCallback } from "grammy";
import { createBot } from "./bot";
import { registerCommands } from "./commands/index";
import { logger } from "../lib/logger";
import type { Env } from "../env";

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  const sec = request.headers.get("x-telegram-bot-api-secret-token");
  if (sec !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });

  const bot = createBot(env);
  registerCommands(bot, env);

  try {
    return await webhookCallback(bot, "cloudflare-mod")(request);
  } catch (err) {
    // Always 200 — Telegram retries are noisy and errors are usually our bug.
    logger.error("telegram webhook failed", { error: String(err) });
    return new Response("OK", { status: 200 });
  }
}
