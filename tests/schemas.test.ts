import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { CreateNotificationSchema, UpdateNotificationSchema } from "../src/api/schemas";

describe("CreateNotificationSchema", () => {
  it("accepts recurring with days", () => {
    expect(v.is(CreateNotificationSchema, {
      kind: "recurring", time: "09:00", timezone: "UTC", message: "wake",
      days: ["mon","tue"],
    })).toBe(true);
  });
  it("accepts one_time with date", () => {
    expect(v.is(CreateNotificationSchema, {
      kind: "one_time", time: "09:00", timezone: "UTC", message: "doctor",
      date: "2026-12-31",
    })).toBe(true);
  });
  it("rejects recurring with empty days", () => {
    expect(v.is(CreateNotificationSchema, {
      kind: "recurring", time: "09:00", timezone: "UTC", message: "x", days: [],
    })).toBe(false);
  });
  it("rejects recurring with duplicate days", () => {
    expect(v.is(CreateNotificationSchema, {
      kind: "recurring", time: "09:00", timezone: "UTC", message: "x", days: ["mon","mon"],
    })).toBe(false);
  });
  it("rejects malformed time", () => {
    expect(v.is(CreateNotificationSchema, {
      kind: "one_time", time: "25:00", timezone: "UTC", message: "x", date: "2026-01-01",
    })).toBe(false);
  });
});

describe("UpdateNotificationSchema", () => {
  it("accepts empty partial", () => {
    expect(v.is(UpdateNotificationSchema, {})).toBe(true);
  });
  it("accepts time-only update", () => {
    expect(v.is(UpdateNotificationSchema, { time: "10:30" })).toBe(true);
  });
  it("rejects bad date", () => {
    expect(v.is(UpdateNotificationSchema, { date: "not-a-date" })).toBe(false);
  });
});
