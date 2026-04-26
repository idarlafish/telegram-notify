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
  if (sec !== env.WEBHOOK_SECRET) {
    logger.warn("webhook secret mismatch", {
      received_len: sec?.length ?? 0,
      expected_len: env.WEBHOOK_SECRET?.length ?? 0,
    });
    return new Response("forbidden", { status: 403 });
  }

  const bot = createBot(env);
  bot.catch((err) => {
    logger.error("grammy handler error", {
      error: String(err.error),
      message: err.error instanceof Error ? err.error.message : undefined,
      stack: err.error instanceof Error ? err.error.stack : undefined,
      update_id: err.ctx.update.update_id,
    });
  });
  registerCommands(bot, env);

  try {
    logger.info("webhook received", {
      update_id: ((await request.clone().json()) as { update_id?: number }).update_id,
    });
    return await webhookCallback(bot, "cloudflare-mod")(request);
  } catch (err) {
    // Always 200 — Telegram retries are noisy and errors are usually our bug.
    logger.error("telegram webhook failed", { error: String(err) });
    return new Response("OK", { status: 200 });
  }
}
