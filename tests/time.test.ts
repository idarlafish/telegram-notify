import { describe, it, expect } from "vitest";
import { computeNextFireAt } from "../src/lib/time";

describe("computeNextFireAt", () => {
  // 2026-01-15T00:00:00Z is 09:00 in Asia/Tokyo (UTC+9, no DST).
  const fromMs = Date.UTC(2026, 0, 15, 0, 0, 0);

  it("returns today's instance when target hasn't passed yet", () => {
    // 10:00 Tokyo = 1h after "now" = 2026-01-15T01:00:00Z
    expect(computeNextFireAt("10:00", "Asia/Tokyo", fromMs)).toBe(
      Date.UTC(2026, 0, 15, 1, 0, 0),
    );
  });

  it("rolls to tomorrow when target has already passed", () => {
    // It's 09:00 Tokyo; 08:00 Tokyo passed → tomorrow 08:00 Tokyo = 2026-01-15T23:00:00Z
    expect(computeNextFireAt("08:00", "Asia/Tokyo", fromMs)).toBe(
      Date.UTC(2026, 0, 15, 23, 0, 0),
    );
  });

  it("snaps to top of the target minute regardless of seconds offset", () => {
    // Move "now" to 09:30:45 Tokyo (= 00:30:45 UTC). Target 10:00 Tokyo → 01:00 UTC sharp.
    const from = Date.UTC(2026, 0, 15, 0, 30, 45);
    expect(computeNextFireAt("10:00", "Asia/Tokyo", from)).toBe(
      Date.UTC(2026, 0, 15, 1, 0, 0),
    );
  });

  it("throws on malformed time", () => {
    expect(() => computeNextFireAt("25:99", "UTC")).toThrow();
    expect(() => computeNextFireAt("not-a-time", "UTC")).toThrow();
  });
});
