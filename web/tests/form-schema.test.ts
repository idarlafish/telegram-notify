import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { ReminderFormSchema } from "../src/lib/form-schema";

describe("ReminderFormSchema", () => {
  const base = { time: "09:00", message: "drink water", timezone: "UTC" };

  it("accepts repeating with all 7 days", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "repeating",
      days: ["mon","tue","wed","thu","fri","sat","sun"],
    })).toBe(true);
  });
  it("accepts repeating with subset", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "repeating", days: ["mon","wed","fri"],
    })).toBe(true);
  });
  it("rejects repeating with empty days", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "repeating", days: [],
    })).toBe(false);
  });
  it("accepts one_time with date", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "one_time", date: "2026-12-31",
    })).toBe(true);
  });
  it("rejects one_time without date", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "one_time" })).toBe(false);
  });
  it("rejects empty message", () => {
    expect(v.is(ReminderFormSchema, { ...base, message: "", repeat: "repeating", days: ["mon"] })).toBe(false);
  });
  it("rejects bad time", () => {
    expect(v.is(ReminderFormSchema, { ...base, time: "25:99", repeat: "repeating", days: ["mon"] })).toBe(false);
  });
  it("rejects unknown repeat value", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "daily" })).toBe(false);
  });
});
