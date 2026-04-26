import { describe, it, expect } from "vitest";
import { daysToBitmask, bitmaskToDays, type WeekDay } from "../src/db/mappers";

describe("daysToBitmask / bitmaskToDays", () => {
  it("maps single days to powers of two (Mon=1..Sun=64)", () => {
    expect(daysToBitmask(["mon"])).toBe(1);
    expect(daysToBitmask(["tue"])).toBe(2);
    expect(daysToBitmask(["wed"])).toBe(4);
    expect(daysToBitmask(["thu"])).toBe(8);
    expect(daysToBitmask(["fri"])).toBe(16);
    expect(daysToBitmask(["sat"])).toBe(32);
    expect(daysToBitmask(["sun"])).toBe(64);
  });
  it("daily = 127", () => {
    expect(daysToBitmask(["mon","tue","wed","thu","fri","sat","sun"])).toBe(127);
  });
  it("weekdays = 31, weekends = 96", () => {
    expect(daysToBitmask(["mon","tue","wed","thu","fri"])).toBe(31);
    expect(daysToBitmask(["sat","sun"])).toBe(96);
  });
  it("round-trips for all 127 valid masks", () => {
    for (let m = 1; m <= 127; m++) {
      expect(daysToBitmask(bitmaskToDays(m))).toBe(m);
    }
  });
  it("bitmaskToDays returns days in canonical order Mon..Sun", () => {
    expect(bitmaskToDays(0b0010101)).toEqual<WeekDay[]>(["mon","wed","fri"]);
  });
  it("rejects empty array", () => {
    expect(() => daysToBitmask([])).toThrow();
  });
  it("rejects out-of-range bitmask", () => {
    expect(() => bitmaskToDays(0)).toThrow();
    expect(() => bitmaskToDays(128)).toThrow();
  });
});
