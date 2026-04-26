import { describe, it, expect } from "vitest";
import { verifyInitData } from "../src/telegram/auth";
import type { Env } from "../src/env";

const BOT_TOKEN = "1234:abc-test-token";
const env = { BOT_TOKEN } as unknown as Env;

// Mirror the signing algorithm so we can produce initData that should validate.
async function signInitData(params: Record<string, string>): Promise<string> {
  const enc = new TextEncoder();
  const dataCheck = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", secretKey, enc.encode(BOT_TOKEN));

  const verifyKey = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", verifyKey, enc.encode(dataCheck));
  const hash = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return new URLSearchParams({ ...params, hash }).toString();
}

describe("verifyInitData", () => {
  it("accepts valid signed initData", async () => {
    const initData = await signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42, first_name: "Ada" }),
    });
    expect(await verifyInitData(initData, env)).toEqual({ id: 42, first_name: "Ada" });
  });

  it("rejects tampered hash", async () => {
    let initData = await signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 42 }),
    });
    initData = initData.replace(/hash=.+$/, `hash=${"0".repeat(64)}`);
    expect(await verifyInitData(initData, env)).toBeNull();
  });

  it("rejects stale auth_date (> 24h)", async () => {
    const initData = await signInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 90_000),
      user: JSON.stringify({ id: 42 }),
    });
    expect(await verifyInitData(initData, env)).toBeNull();
  });

  it("rejects empty initData", async () => {
    expect(await verifyInitData("", env)).toBeNull();
  });
});
