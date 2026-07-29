import { createBot } from "../../telegram/bot";
import type { Env } from "../../env";

export type DeliveryOutcome =
  | { kind: "ok" }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "transient"; error: string }
  | { kind: "unreachable"; reason: string };

export async function deliver(
  env: Env,
  chatId: number,
  text: string,
  notificationId: string,
): Promise<DeliveryOutcome> {
  const bot = createBot(env);
  try {
    await bot.api.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: "✅", callback_data: `done:${notificationId}` }]],
      },
    });
    return { kind: "ok" };
  } catch (err) {
    if (is429(err)) return { kind: "rate_limited", retryAfterMs: parseRetryAfter(err) * 1000 };
    if (isUnreachable(err)) return { kind: "unreachable", reason: String(err) };
    return { kind: "transient", error: String(err) };
  }
}

function is429(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return (
    e.error_code === 429 ||
    (typeof e.message === "string" && (e.message as string).includes("Too Many Requests"))
  );
}

function isUnreachable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  const desc = typeof e.description === "string" ? e.description : "";
  return e.error_code === 403 || (e.error_code === 400 && /chat not found/i.test(desc));
}

function parseRetryAfter(err: unknown): number {
  if (!err || typeof err !== "object") return 30;
  const e = err as Record<string, unknown>;
  const params = e.parameters as { retry_after?: number } | undefined;
  return params?.retry_after ?? 30;
}
