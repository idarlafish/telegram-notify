import { describe, it, expect } from "vitest";
import { nextRecurring, oneTimeFireAt } from "../src/lib/time";

describe("nextRecurring", () => {
  // 2026-01-15 is Thu; 00:00 UTC = 09:00 Asia/Tokyo (UTC+9, no DST).
  const fromMs = Date.UTC(2026, 0, 15, 0, 0, 0);

  it("daily mask returns today when target hour is in the future", () => {
    expect(nextRecurring("10:00", "Asia/Tokyo", 0b1111111, fromMs))
      .toBe(Date.UTC(2026, 0, 15, 1, 0, 0));
  });
  it("daily mask rolls to tomorrow when target has passed", () => {
    expect(nextRecurring("08:00", "Asia/Tokyo", 0b1111111, fromMs))
      .toBe(Date.UTC(2026, 0, 15, 23, 0, 0));
  });
  it("weekdays mask (31) on Thu 09:00 → Fri 08:00 Tokyo (Thu 23:00 UTC)", () => {
    expect(nextRecurring("08:00", "Asia/Tokyo", 31, fromMs))
      .toBe(Date.UTC(2026, 0, 15, 23, 0, 0));
  });
  it("weekends mask (96) on Thu 09:00 → Sat 09:00 Tokyo", () => {
    expect(nextRecurring("09:00", "Asia/Tokyo", 96, fromMs))
      .toBe(Date.UTC(2026, 0, 17, 0, 0, 0));
  });
  it("Mon+Wed+Fri (mask=21) on Thu → Fri 12:00 Tokyo", () => {
    expect(nextRecurring("12:00", "Asia/Tokyo", 21, fromMs))
      .toBe(Date.UTC(2026, 0, 16, 3, 0, 0));
  });
  it("snaps to top of target minute regardless of seconds", () => {
    const from = Date.UTC(2026, 0, 15, 0, 30, 45);
    expect(nextRecurring("10:00", "Asia/Tokyo", 0b1111111, from))
      .toBe(Date.UTC(2026, 0, 15, 1, 0, 0));
  });
  it("throws on malformed time", () => {
    expect(() => nextRecurring("25:99", "UTC", 127, fromMs)).toThrow();
  });
});

describe("oneTimeFireAt", () => {
  it("computes UTC ms for a future date+time in Tokyo (UTC+9)", () => {
    expect(oneTimeFireAt("2026-05-20", "14:30", "Asia/Tokyo"))
      .toBe(Date.UTC(2026, 4, 20, 5, 30, 0));
  });
  it("computes UTC ms for an evening time in Asia/Nicosia (UTC+3)", () => {
    // Regression: positive-tz evening times used to fall outside the old
    // probe window. 18:15 Nicosia = 15:15 UTC.
    expect(oneTimeFireAt("2026-05-20", "18:15", "Asia/Nicosia"))
      .toBe(Date.UTC(2026, 4, 20, 15, 15, 0));
  });
  it("computes UTC ms in a UTC-negative tz (America/Los_Angeles, PDT=-7)", () => {
    // 09:00 LA = 16:00 UTC during PDT
    expect(oneTimeFireAt("2026-07-15", "09:00", "America/Los_Angeles"))
      .toBe(Date.UTC(2026, 6, 15, 16, 0, 0));
  });
  it("throws when resolved moment is in the past", () => {
    expect(() => oneTimeFireAt("2020-01-01", "00:00", "UTC")).toThrow();
  });
});
