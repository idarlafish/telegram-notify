import { describe, it, expect, vi, afterEach } from "vitest";
import { formatLocalTime, daysSummary, countdownText } from "../src/lib/time";

afterEach(() => vi.useRealTimers());

describe("formatLocalTime", () => {
  it("formats UTC ms as HH:MM in tz", () => {
    expect(formatLocalTime(Date.UTC(2026, 0, 15, 1, 0, 0), "Asia/Tokyo")).toBe("10:00");
  });
});

describe("daysSummary", () => {
  it("daily", () => {
    expect(daysSummary(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe("Daily");
  });
  it("weekdays", () => {
    expect(daysSummary(["mon", "tue", "wed", "thu", "fri"])).toBe("Weekdays");
  });
  it("weekends", () => {
    expect(daysSummary(["sat", "sun"])).toBe("Weekends");
  });
  it("custom three days", () => {
    expect(daysSummary(["mon", "wed", "fri"])).toBe("Mon, Wed, Fri");
  });
});

describe("countdownText", () => {
  it("hours and minutes", () => {
    vi.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 0, 15, 12, 0, 0)));
    expect(countdownText(Date.UTC(2026, 0, 15, 14, 30, 0))).toBe("in 2h 30m");
  });
  it("minutes only", () => {
    vi.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 0, 15, 12, 0, 0)));
    expect(countdownText(Date.UTC(2026, 0, 15, 12, 5, 0))).toBe("in 5m");
  });
  it("days when far away", () => {
    vi.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 0, 15, 12, 0, 0)));
    expect(countdownText(Date.UTC(2026, 0, 18, 12, 0, 0))).toBe("in 3 days");
  });
});
