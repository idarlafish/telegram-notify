import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAlarm } from "../src/scheduler/user-do/refresh-alarm";

function makeCtx(min: number | null) {
  const from = vi.fn().mockResolvedValue([{ min }]);
  const select = vi.fn().mockReturnValue({ from });
  const setAlarm = vi.fn().mockResolvedValue(undefined);
  const deleteAlarm = vi.fn().mockResolvedValue(undefined);
  const db = { select } as never;
  const storage = { setAlarm, deleteAlarm } as never;
  return { db, storage, setAlarm, deleteAlarm };
}

describe("refreshAlarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deletes the alarm when there are no rows", async () => {
    const { db, storage, deleteAlarm, setAlarm } = makeCtx(null);

    await refreshAlarm(db, storage);

    expect(deleteAlarm).toHaveBeenCalledOnce();
    expect(setAlarm).not.toHaveBeenCalled();
  });

  it("sets the alarm to the earliest future fire time", async () => {
    const future = Date.now() + 10_000;
    const { db, storage, setAlarm } = makeCtx(future);

    await refreshAlarm(db, storage);

    expect(setAlarm).toHaveBeenCalledWith(future);
  });

  it("never arms an alarm in the past (guards against the hot loop)", async () => {
    const past = Date.now() - 10_000;
    const { db, storage, setAlarm } = makeCtx(past);

    await refreshAlarm(db, storage);

    expect(setAlarm).toHaveBeenCalledOnce();
    expect(setAlarm.mock.calls[0][0]).toBeGreaterThan(Date.now());
  });
});
