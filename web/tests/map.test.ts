import { describe, it, expect } from "vitest";
import { formToApiBody, apiRowToForm } from "../src/api/map";
import type { Notification } from "../src/api/types";

describe("formToApiBody", () => {
  const base = { time: "09:00", message: "x", timezone: "UTC" };

  it("daily → recurring with all days", () => {
    expect(formToApiBody({ ...base, repeat: "daily" })).toEqual({
      ...base, kind: "recurring", days: ["mon","tue","wed","thu","fri","sat","sun"],
    });
  });
  it("weekdays preset", () => {
    expect(formToApiBody({ ...base, repeat: "weekdays" })).toEqual({
      ...base, kind: "recurring", days: ["mon","tue","wed","thu","fri"],
    });
  });
  it("custom uses customDays", () => {
    expect(formToApiBody({ ...base, repeat: "custom", customDays: ["tue","thu"] })).toEqual({
      ...base, kind: "recurring", days: ["tue","thu"],
    });
  });
  it("one_time uses date", () => {
    expect(formToApiBody({ ...base, repeat: "one_time", date: "2026-12-31" })).toEqual({
      ...base, kind: "one_time", date: "2026-12-31",
    });
  });
});

describe("apiRowToForm", () => {
  const base = {
    id: "x", message: "m", time: "09:00", timezone: "UTC",
    next_fire_at: 0, last_sent_at: null, created_at: 0,
  };

  it("detects daily preset", () => {
    const row: Notification = {
      ...base, kind: "recurring",
      days: ["mon","tue","wed","thu","fri","sat","sun"],
    };
    expect(apiRowToForm(row).repeat).toBe("daily");
  });
  it("detects weekdays preset", () => {
    const row: Notification = {
      ...base, kind: "recurring", days: ["mon","tue","wed","thu","fri"],
    };
    expect(apiRowToForm(row).repeat).toBe("weekdays");
  });
  it("falls back to custom for non-preset", () => {
    const row: Notification = {
      ...base, kind: "recurring", days: ["mon","wed","fri"],
    };
    const f = apiRowToForm(row);
    expect(f.repeat).toBe("custom");
    expect(f.customDays).toEqual(["mon","wed","fri"]);
  });
  it("one_time derives date from next_fire_at", () => {
    const row: Notification = {
      ...base, kind: "one_time",
      next_fire_at: Date.UTC(2026, 11, 31, 0, 0, 0),
      timezone: "UTC",
    };
    const f = apiRowToForm(row);
    expect(f.repeat).toBe("one_time");
    expect(f.date).toBe("2026-12-31");
  });
});
