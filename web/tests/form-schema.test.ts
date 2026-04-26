import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { ReminderFormSchema } from "../src/lib/form-schema";

describe("ReminderFormSchema", () => {
  const base = { time: "09:00", message: "drink water", timezone: "UTC" };

  it("accepts a daily reminder", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "daily" })).toBe(true);
  });
  it("accepts a custom reminder with selected days", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "custom", customDays: ["mon","wed","fri"],
    })).toBe(true);
  });
  it("rejects custom with empty days", () => {
    expect(v.is(ReminderFormSchema, {
      ...base, repeat: "custom", customDays: [],
    })).toBe(false);
  });
  it("rejects one_time without date", () => {
    expect(v.is(ReminderFormSchema, { ...base, repeat: "one_time" })).toBe(false);
  });
  it("rejects empty message", () => {
    expect(v.is(ReminderFormSchema, { ...base, message: "", repeat: "daily" })).toBe(false);
  });
  it("rejects bad time", () => {
    expect(v.is(ReminderFormSchema, { ...base, time: "25:99", repeat: "daily" })).toBe(false);
  });
});
