import { createBot } from "../../telegram/bot";
import type { Env } from "../../env";

export async function sendNotification(
  env: Env,
  chatId: number,
  text: string,
  notificationId: string,
): Promise<void> {
  const bot = createBot(env);
  await bot.api.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[{ text: "✅", callback_data: `done:${notificationId}` }]],
    },
  });
}

export function is429(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return (
    e.error_code === 429 ||
    (typeof e.message === "string" && (e.message as string).includes("Too Many Requests"))
  );
}

export function parseRetryAfter(err: unknown): number {
  if (!err || typeof err !== "object") return 30;
  const e = err as Record<string, unknown>;
  const params = e.parameters as { retry_after?: number } | undefined;
  return params?.retry_after ?? 30;
}
