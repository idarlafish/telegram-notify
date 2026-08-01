import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "grammy";
import type { Env } from "../src/env";

const logInfo = vi.hoisted(() => vi.fn());
const logWarn = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/logger", () => ({
  logger: { info: logInfo, warn: logWarn, error: logError, event: vi.fn() },
}));

const fakeBot = vi.hoisted(() => ({ catch: vi.fn(), use: vi.fn() }));
const createBot = vi.hoisted(() => vi.fn(() => fakeBot));
vi.mock("../src/telegram/bot", () => ({ createBot }));

const registerCommands = vi.hoisted(() => vi.fn());
vi.mock("../src/telegram/commands/index", () => ({ registerCommands }));

const webhookHandler = vi.hoisted(() => vi.fn(async () => new Response("ok-from-grammy")));
const webhookCallback = vi.hoisted(() => vi.fn(() => webhookHandler));
vi.mock("grammy", () => ({ webhookCallback }));

import { handleTelegramWebhook, logUpdate } from "../src/telegram/webhook";

const env = { WEBHOOK_SECRET: "s3cret" } as Env;

function req(secret?: string): Request {
  return new Request("https://x/telegram-webhook", {
    method: "POST",
    headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
    body: JSON.stringify({ update_id: 1 }),
  });
}

describe("handleTelegramWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookHandler.mockResolvedValue(new Response("ok-from-grammy"));
  });

  it("rejects a wrong secret with 403 and never invokes grammy", async () => {
    const res = await handleTelegramWebhook(req("wrong"), env);
    expect(res.status).toBe(403);
    expect(logWarn).toHaveBeenCalledWith("webhook secret mismatch", expect.any(Object));
    expect(createBot).not.toHaveBeenCalled();
    expect(webhookCallback).not.toHaveBeenCalled();
  });

  it("rejects a missing secret with 403", async () => {
    const res = await handleTelegramWebhook(req(), env);
    expect(res.status).toBe(403);
  });

  it("delegates to grammy using the documented cloudflare-mod pattern and returns its response", async () => {
    const res = await handleTelegramWebhook(req("s3cret"), env);
    expect(webhookCallback).toHaveBeenCalledWith(fakeBot, "cloudflare-mod");
    expect(fakeBot.use).toHaveBeenCalledWith(logUpdate);
    expect(registerCommands).toHaveBeenCalledWith(fakeBot, env);
    expect(await res.text()).toBe("ok-from-grammy");
  });

  it("does not read or clone the request body itself (grammy is the sole reader)", async () => {
    const r = req("s3cret");
    const cloneSpy = vi.spyOn(r, "clone");
    await handleTelegramWebhook(r, env);
    expect(cloneSpy).not.toHaveBeenCalled();
    expect(r.bodyUsed).toBe(false);
  });

  it("returns 200 and logs when grammy throws", async () => {
    webhookHandler.mockRejectedValueOnce(new Error("boom"));
    const res = await handleTelegramWebhook(req("s3cret"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    expect(logError).toHaveBeenCalledWith("telegram webhook failed", { error: "Error: boom" });
  });
});

describe("logUpdate", () => {
  it("logs update_id from the parsed update and calls next (no request re-read)", async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = { update: { update_id: 42 } } as unknown as Context;

    await logUpdate(ctx, next);

    expect(logInfo).toHaveBeenCalledWith("webhook received", { update_id: 42 });
    expect(next).toHaveBeenCalledOnce();
  });
});
