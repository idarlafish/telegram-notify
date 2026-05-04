import { describe, it, expect } from "vitest";
import { formToApiBody, apiRowToForm } from "../src/api/map";
import type { Notification } from "../src/api/types";

describe("formToApiBody", () => {
  const base = { time: "09:00", message: "x", timezone: "UTC" };

  it("repeating uses days as-is", () => {
    expect(
      formToApiBody({
        ...base,
        repeat: "repeating",
        days: ["tue", "thu"],
      }),
    ).toEqual({ ...base, kind: "recurring", days: ["tue", "thu"] });
  });
  it("repeating with all days", () => {
    expect(
      formToApiBody({
        ...base,
        repeat: "repeating",
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      }),
    ).toEqual({
      ...base,
      kind: "recurring",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    });
  });
  it("one_time uses date", () => {
    expect(
      formToApiBody({
        ...base,
        repeat: "one_time",
        date: "2026-12-31",
      }),
    ).toEqual({ ...base, kind: "one_time", date: "2026-12-31" });
  });
});

describe("apiRowToForm", () => {
  const base = {
    id: "x",
    message: "m",
    time: "09:00",
    timezone: "UTC",
    next_fire_at: 0,
    last_sent_at: null,
    created_at: 0,
  };

  it("recurring → repeating with days", () => {
    const row: Notification = {
      ...base,
      kind: "recurring",
      days: ["mon", "wed", "fri"],
    };
    const f = apiRowToForm(row);
    expect(f.repeat).toBe("repeating");
    expect(f.days).toEqual(["mon", "wed", "fri"]);
  });
  it("recurring with all 7 days", () => {
    const row: Notification = {
      ...base,
      kind: "recurring",
      days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    };
    const f = apiRowToForm(row);
    expect(f.repeat).toBe("repeating");
    expect(f.days).toHaveLength(7);
  });
  it("one_time derives date from next_fire_at", () => {
    const row: Notification = {
      ...base,
      kind: "one_time",
      next_fire_at: Date.UTC(2026, 11, 31, 0, 0, 0),
      timezone: "UTC",
    };
    const f = apiRowToForm(row);
    expect(f.repeat).toBe("one_time");
    expect(f.date).toBe("2026-12-31");
  });
});
