import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import type { AlarmCtx } from "../src/scheduler/user-do/alarm";

const deliveryMocks = vi.hoisted(() => ({
  deliver: vi.fn(),
}));
vi.mock("../src/scheduler/user-do/delivery", () => deliveryMocks);

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  destroyProfile: vi.fn(),
}));
vi.mock("../src/scheduler/user-do/profile", () => profileMocks);

const refreshAlarmMock = vi.hoisted(() => vi.fn());
vi.mock("../src/scheduler/user-do/refresh-alarm", () => ({
  refreshAlarm: refreshAlarmMock,
}));

const decryptMessageMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/crypto", () => ({
  decryptMessage: decryptMessageMock,
}));

const nextRecurringMock = vi.hoisted(() => vi.fn());
vi.mock("../src/scheduler/user-do/time", () => ({
  nextRecurring: nextRecurringMock,
}));

const logEventMock = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/logger", () => ({
  logger: { event: logEventMock },
}));

import { fireAndAdvance } from "../src/scheduler/user-do/alarm";

type DueRow = {
  id: string;
  kind: "one_time" | "recurring";
  message: string;
  time: string;
  timezone: string;
  weekdays: number | null;
  next_fire_at: number;
};

function dueRow(partial: Partial<DueRow> & Pick<DueRow, "id">): DueRow {
  return {
    id: partial.id,
    kind: partial.kind ?? "one_time",
    message: partial.message ?? "cipher",
    time: partial.time ?? "10:00",
    timezone: partial.timezone ?? "Europe/Helsinki",
    weekdays: partial.weekdays ?? 1,
    next_fire_at: partial.next_fire_at ?? Date.now(),
  };
}

function makeCtx(rows: DueRow[]) {
  const selectWhere = vi.fn().mockResolvedValue(rows);
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockReturnValue({ where: deleteWhere });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  const setAlarm = vi.fn().mockResolvedValue(undefined);

  const ctx = {
    db: {
      select,
      delete: del,
      update,
    },
    storage: { setAlarm },
    env: {} as Env,
  } as unknown as AlarmCtx;

  return { ctx, setAlarm, del, deleteWhere, update, updateSet, updateWhere };
}

describe("fireAndAdvance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    profileMocks.getProfile.mockResolvedValue({ chat_id: 42, created_at: 0 });
    decryptMessageMock.mockResolvedValue("plain text");
    nextRecurringMock.mockReturnValue(Date.now() + 86_400_000);
    deliveryMocks.deliver.mockResolvedValue({ kind: "ok" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the max retry_after when multiple notifications are rate limited", async () => {
    deliveryMocks.deliver.mockImplementation(async (_env, _chatId, _text, id: string) => {
      if (id === "a") return { kind: "rate_limited", retryAfterMs: 3_000 };
      if (id === "b") return { kind: "rate_limited", retryAfterMs: 9_000 };
      return { kind: "ok" };
    });

    const { ctx, setAlarm } = makeCtx([dueRow({ id: "a" }), dueRow({ id: "b" })]);
    const now = Date.now();

    await fireAndAdvance(ctx);

    expect(setAlarm).toHaveBeenCalledOnce();
    expect(setAlarm).toHaveBeenCalledWith(now + 9_000);
    expect(refreshAlarmMock).not.toHaveBeenCalled();
  });

  it("continues processing all due notifications and schedules fallback on transient errors", async () => {
    deliveryMocks.deliver.mockImplementation(async (_env, _chatId, _text, id: string) => {
      if (id === "bad") return { kind: "transient", error: "boom" };
      return { kind: "ok" };
    });

    const { ctx, setAlarm, updateSet } = makeCtx([
      dueRow({ id: "bad", kind: "one_time" }),
      dueRow({ id: "good", kind: "recurring" }),
    ]);
    const now = Date.now();

    await fireAndAdvance(ctx);

    expect(deliveryMocks.deliver).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenCalledOnce();
    expect(setAlarm).toHaveBeenCalledOnce();
    expect(setAlarm).toHaveBeenCalledWith(now + 60_000);
    expect(refreshAlarmMock).not.toHaveBeenCalled();
  });

  it("refreshes alarm after successful processing", async () => {
    const { ctx, deleteWhere, setAlarm } = makeCtx([dueRow({ id: "ok", kind: "one_time" })]);

    await fireAndAdvance(ctx);

    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(refreshAlarmMock).toHaveBeenCalledOnce();
    expect(setAlarm).not.toHaveBeenCalled();
  });

  it("skips a stale recurring row without sending and advances it", async () => {
    const now = Date.now();
    const { ctx, updateSet } = makeCtx([
      dueRow({ id: "stale", kind: "recurring", next_fire_at: now - 6 * 60_000 }),
    ]);

    await fireAndAdvance(ctx);

    expect(deliveryMocks.deliver).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledOnce();
    expect(logEventMock).toHaveBeenCalledWith(expect.anything(), "alarm_skip", {
      id: "stale",
      kind: "recurring",
    });
    expect(refreshAlarmMock).toHaveBeenCalledOnce();
  });

  it("skips a stale one-time row without sending and deletes it", async () => {
    const now = Date.now();
    const { ctx, deleteWhere } = makeCtx([
      dueRow({ id: "stale1", kind: "one_time", next_fire_at: now - 6 * 60_000 }),
    ]);

    await fireAndAdvance(ctx);

    expect(deliveryMocks.deliver).not.toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalledOnce();
    expect(refreshAlarmMock).toHaveBeenCalledOnce();
  });

  it("sends fresh due rows and advances stale rows in the same alarm", async () => {
    const now = Date.now();
    const { ctx, updateSet } = makeCtx([
      dueRow({ id: "fresh", kind: "recurring", next_fire_at: now }),
      dueRow({ id: "stale", kind: "recurring", next_fire_at: now - 6 * 60_000 }),
    ]);

    await fireAndAdvance(ctx);

    expect(deliveryMocks.deliver).toHaveBeenCalledOnce();
    expect(deliveryMocks.deliver).toHaveBeenCalledWith(
      expect.anything(),
      42,
      "plain text",
      "fresh",
    );
    expect(updateSet).toHaveBeenCalledTimes(2);
    expect(refreshAlarmMock).toHaveBeenCalledOnce();
  });

  it("purges the user when delivery reports the recipient is unreachable", async () => {
    deliveryMocks.deliver.mockResolvedValue({
      kind: "unreachable",
      reason: "Forbidden: bot was blocked by the user",
    });

    const now = Date.now();
    const { ctx, del, deleteWhere, setAlarm } = makeCtx([
      dueRow({ id: "blocked", kind: "recurring", next_fire_at: now }),
    ]);

    await fireAndAdvance(ctx);

    expect(del).toHaveBeenCalledOnce();
    expect(deleteWhere).not.toHaveBeenCalled();
    expect(profileMocks.destroyProfile).toHaveBeenCalledOnce();
    expect(refreshAlarmMock).not.toHaveBeenCalled();
    expect(setAlarm).not.toHaveBeenCalled();
  });

  it("logs the error detail on a transient outcome", async () => {
    deliveryMocks.deliver.mockResolvedValue({ kind: "transient", error: "boom" });
    const { ctx } = makeCtx([dueRow({ id: "t", kind: "recurring", next_fire_at: Date.now() })]);

    await fireAndAdvance(ctx);

    expect(logEventMock).toHaveBeenCalledWith(expect.anything(), "alarm_fire", {
      id: "t",
      kind: "recurring",
      outcome: "transient",
      error: "boom",
    });
  });

  it("logs the reason on an unreachable outcome", async () => {
    deliveryMocks.deliver.mockResolvedValue({ kind: "unreachable", reason: "bot blocked" });
    const { ctx } = makeCtx([dueRow({ id: "u", kind: "recurring", next_fire_at: Date.now() })]);

    await fireAndAdvance(ctx);

    expect(logEventMock).toHaveBeenCalledWith(expect.anything(), "alarm_fire", {
      id: "u",
      kind: "recurring",
      outcome: "unreachable",
      reason: "bot blocked",
    });
  });

  it("isolates a decryption failure as a transient outcome without aborting the batch", async () => {
    decryptMessageMock.mockImplementation(async (_env: Env, msg: string) => {
      if (msg === "bad-cipher") throw new Error("decrypt failed");
      return "plain text";
    });
    const now = Date.now();
    const { ctx, updateSet, setAlarm } = makeCtx([
      dueRow({ id: "bad", kind: "recurring", message: "bad-cipher", next_fire_at: now }),
      dueRow({ id: "good", kind: "recurring", message: "ok-cipher", next_fire_at: now }),
    ]);

    await fireAndAdvance(ctx);

    expect(deliveryMocks.deliver).toHaveBeenCalledOnce();
    expect(deliveryMocks.deliver).toHaveBeenCalledWith(expect.anything(), 42, "plain text", "good");
    expect(updateSet).toHaveBeenCalledOnce();
    expect(setAlarm).toHaveBeenCalledWith(now + 60_000);
    expect(logEventMock).toHaveBeenCalledWith(expect.anything(), "alarm_fire", {
      id: "bad",
      kind: "recurring",
      outcome: "transient",
      error: "Error: decrypt failed",
    });
  });
});
