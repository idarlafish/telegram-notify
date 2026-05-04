import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as v from "valibot";
import { ReminderFormSchema } from "../src/lib/form-schema";

describe("ReminderFormSchema", () => {
  const base = { time: "09:00", message: "drink water", timezone: "UTC" };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 4, 19, 54, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts repeating with all 7 days", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "repeating",
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      }),
    ).toBe(true);
  });
  it("accepts repeating with subset", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "repeating",
        days: ["mon", "wed", "fri"],
      }),
    ).toBe(true);
  });
  it("rejects repeating with empty days", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "repeating",
        days: [],
      }),
    ).toBe(false);
  });
  it("accepts one_time with date", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "one_time",
        date: "2026-12-31",
      }),
    ).toBe(true);
  });
  it("rejects one_time without date", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "one_time" })).toBe(false);
  });
  it("rejects one_time when date+time is in the past", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "one_time",
        date: "2026-05-04",
        time: "19:54",
      }),
    ).toBe(false);
  });
  it("accepts one_time later today when time is in the future", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "one_time",
        date: "2026-05-04",
        time: "20:00",
      }),
    ).toBe(true);
  });
  it("accepts one_time on a future date", () => {
    expect(
      v.is(ReminderFormSchema, {
        ...base,
        repeat: "one_time",
        date: "2026-05-05",
        time: "00:01",
      }),
    ).toBe(true);
  });
  it("rejects empty message", () => {
    expect(
      v.is(ReminderFormSchema, { ...base, message: "", repeat: "repeating", days: ["mon"] }),
    ).toBe(false);
  });
  it("rejects bad time", () => {
    expect(
      v.is(ReminderFormSchema, { ...base, time: "25:99", repeat: "repeating", days: ["mon"] }),
    ).toBe(false);
  });
  it("rejects unknown repeat value", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "daily" })).toBe(false);
  });
});
