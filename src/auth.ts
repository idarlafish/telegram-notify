// Telegram Mini App authentication: validates the initData query string sent
// by the Mini App SDK against the bot token via HMAC-SHA256, per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Returns the parsed user info on success, or null on failure.

import type { Env } from "./types.ts";

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

export async function verifyInitData(
  initData: string,
  env: Env,
): Promise<TelegramUser | null> {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  // auth_date is required and must be recent (within 24h).
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null;

  // Build data-check string: keys sorted alphabetically, key=value\n joined.
  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // HMAC: secret = HMAC_SHA256("WebAppData", bot_token); then HMAC(secret, dataCheck).
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(env.BOT_TOKEN));

  const verifyKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const computed = await crypto.subtle.sign("HMAC", verifyKey, enc.encode(dataCheck));

  const computedHex = [...new Uint8Array(computed)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedHex !== hash) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as TelegramUser;
  } catch {
    return null;
  }
}
