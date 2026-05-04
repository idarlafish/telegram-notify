import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../src/env";
import type { DueNotification } from "../src/db/notifications";

const dbMocks = vi.hoisted(() => ({
  findDueNotifications: vi.fn(),
  recordSent: vi.fn(),
  deleteById: vi.fn(),
}));
vi.mock("../src/db/notifications", () => dbMocks);

const botMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));
vi.mock("../src/telegram/bot", () => ({
  createBot: () => ({ api: { sendMessage: botMocks.sendMessage } }),
}));

import { runCronTick } from "../src/scheduler/tick";

function fakeEnv() {
  const kv = new Map<string, string>();
  const env = {
    BOT_TOKEN: "test:token",
    CRON_STATE: {
      get: async (k: string) => kv.get(k) ?? null,
      put: async (k: string, v: string) => {
        kv.set(k, v);
      },
    },
    ANALYTICS: { writeDataPoint: vi.fn() },
  } as unknown as Env;
  return { env, kv };
}

const baseDue = {
  user_id: 100,
  chat_id: 100,
  time: "10:00",
  timezone: "Europe/Helsinki",
  next_fire_at: 1_700_000_000_000,
  last_sent_at: null,
  created_at: 0,
};

const oneTimeDue: DueNotification = {
  ...baseDue,
  id: "one-1",
  message: "wake up",
  kind: "one_time",
  weekdays: null,
};

const recurringDue: DueNotification = {
  ...baseDue,
  id: "rec-1",
  message: "monday standup",
  kind: "recurring",
  weekdays: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runCronTick", () => {
  it("fires and deletes a one-time notification", async () => {
    dbMocks.findDueNotifications.mockResolvedValue([oneTimeDue]);
    const { env, kv } = fakeEnv();

    await runCronTick(env, 1_700_000_005_000);

    expect(dbMocks.deleteById).toHaveBeenCalledWith(env, "one-1");
    expect(dbMocks.recordSent).not.toHaveBeenCalled();
    expect(botMocks.sendMessage).toHaveBeenCalledWith(
      100,
      "wake up",
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          inline_keyboard: [[{ text: "✅", callback_data: "done:one-1" }]],
        }),
      }),
    );
    expect(kv.get("last_cron_tick_at")).toBe("1700000005000");
  });

  it("fires and reschedules a recurring notification", async () => {
    dbMocks.findDueNotifications.mockResolvedValue([recurringDue]);
    const { env } = fakeEnv();

    await runCronTick(env, 1_700_000_005_000);

    expect(dbMocks.recordSent).toHaveBeenCalledWith(env, recurringDue, 1_700_000_005_000);
    expect(dbMocks.deleteById).not.toHaveBeenCalled();
    expect(botMocks.sendMessage).toHaveBeenCalledWith(100, "monday standup", expect.any(Object));
  });

  it("no due rows: skips fire path but still heartbeats", async () => {
    dbMocks.findDueNotifications.mockResolvedValue([]);
    const { env, kv } = fakeEnv();

    await runCronTick(env, 1_700_000_005_000);

    expect(dbMocks.deleteById).not.toHaveBeenCalled();
    expect(dbMocks.recordSent).not.toHaveBeenCalled();
    expect(botMocks.sendMessage).not.toHaveBeenCalled();
    expect(kv.get("last_cron_tick_at")).toBe("1700000005000");
  });

  it("emits dispatch_lag_ms on cron_tick when scheduledTimeMs provided", async () => {
    dbMocks.findDueNotifications.mockResolvedValue([]);
    const { env } = fakeEnv();
    const scheduledMs = 1_700_000_000_000;
    const nowMs = scheduledMs + 5_000;

    await runCronTick(env, nowMs, scheduledMs);

    const writeDataPoint = env.ANALYTICS.writeDataPoint as ReturnType<typeof vi.fn>;
    const tickCall = writeDataPoint.mock.calls.find((c) => c[0].blobs?.[0] === "cron_tick");
    expect(tickCall, "no cron_tick analytics event written").toBeDefined();
    expect(tickCall![0].doubles).toContain(5_000);
  });

  it("heartbeat is throttled — second tick within 5 min does not rewrite", async () => {
    dbMocks.findDueNotifications.mockResolvedValue([]);
    const { env, kv } = fakeEnv();

    await runCronTick(env, 1_700_000_000_000);
    expect(kv.get("last_cron_tick_at")).toBe("1700000000000");

    // 4 min later: under the 5-min interval, must NOT overwrite.
    await runCronTick(env, 1_700_000_240_000);
    expect(kv.get("last_cron_tick_at")).toBe("1700000000000");

    // Exactly 5 min later: write goes through.
    await runCronTick(env, 1_700_000_300_000);
    expect(kv.get("last_cron_tick_at")).toBe("1700000300000");
  });
});
