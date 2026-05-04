export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const ORDER: readonly WeekDay[] = ["mon","tue","wed","thu","fri","sat","sun"] as const;

export function daysToBitmask(days: readonly WeekDay[]): number {
  if (days.length === 0) throw new Error("days must be non-empty");
  let mask = 0;
  for (const d of days) {
    const idx = ORDER.indexOf(d);
    if (idx < 0) throw new Error(`invalid weekday: ${d}`);
    mask |= 1 << idx;
  }
  return mask;
}

export function bitmaskToDays(mask: number): WeekDay[] {
  if (mask < 1 || mask > 127 || !Number.isInteger(mask)) {
    throw new Error(`invalid bitmask: ${mask}`);
  }
  return ORDER.filter((_, i) => (mask & (1 << i)) !== 0);
}
