import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import type { AlarmCtx } from "../src/scheduler/user-do/alarm";

const deliveryMocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  is429: vi.fn(),
  parseRetryAfter: vi.fn(),
}));
vi.mock("../src/scheduler/user-do/delivery", () => deliveryMocks);

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
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
};

function dueRow(partial: Partial<DueRow> & Pick<DueRow, "id">): DueRow {
  return {
    id: partial.id,
    kind: partial.kind ?? "one_time",
    message: partial.message ?? "cipher",
    time: partial.time ?? "10:00",
    timezone: partial.timezone ?? "Europe/Helsinki",
    weekdays: partial.weekdays ?? 1,
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
    deliveryMocks.is429.mockReturnValue(false);
    deliveryMocks.parseRetryAfter.mockReturnValue(30);
    deliveryMocks.sendNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the max retry_after when multiple notifications are rate limited", async () => {
    deliveryMocks.sendNotification.mockImplementation(async (_env, _chatId, _text, id: string) => {
      if (id === "a") throw { tag: "rate", retryAfter: 3 };
      if (id === "b") throw { tag: "rate", retryAfter: 9 };
    });
    deliveryMocks.is429.mockImplementation((err: unknown) => {
      return typeof err === "object" && err !== null && "tag" in err;
    });
    deliveryMocks.parseRetryAfter.mockImplementation((err: unknown) => {
      if (typeof err === "object" && err !== null && "retryAfter" in err) {
        return Number((err as { retryAfter: number }).retryAfter);
      }
      return 30;
    });

    const { ctx, setAlarm } = makeCtx([dueRow({ id: "a" }), dueRow({ id: "b" })]);
    const now = Date.now();

    await fireAndAdvance(ctx);

    expect(setAlarm).toHaveBeenCalledOnce();
    expect(setAlarm).toHaveBeenCalledWith(now + 9_000);
    expect(refreshAlarmMock).not.toHaveBeenCalled();
  });

  it("continues processing all due notifications and schedules fallback on unexpected errors", async () => {
    deliveryMocks.sendNotification.mockImplementation(async (_env, _chatId, _text, id: string) => {
      if (id === "bad") throw new Error("boom");
    });

    const { ctx, setAlarm, updateSet } = makeCtx([
      dueRow({ id: "bad", kind: "one_time" }),
      dueRow({ id: "good", kind: "recurring" }),
    ]);
    const now = Date.now();

    await fireAndAdvance(ctx);

    expect(deliveryMocks.sendNotification).toHaveBeenCalledTimes(2);
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
});
