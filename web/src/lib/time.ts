import type { WeekDay } from "../api/types";

export function formatLocalTime(ms: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ms));
}

const SHORT: Record<WeekDay, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const ORDER: readonly WeekDay[] = ["mon","tue","wed","thu","fri","sat","sun"];

export function daysSummary(days: readonly WeekDay[]): string {
  const set = new Set(days);
  if (set.size === 7) return "Daily";
  if (set.size === 5 && ["mon","tue","wed","thu","fri"].every((d) => set.has(d as WeekDay))) return "Weekdays";
  if (set.size === 2 && ["sat","sun"].every((d) => set.has(d as WeekDay))) return "Weekends";
  return ORDER.filter((d) => set.has(d)).map((d) => SHORT[d]).join(", ");
}

export function countdownText(targetMs: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, targetMs - nowMs);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remM = minutes % 60;
    return remM > 0 ? `in ${hours}h ${remM}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}
