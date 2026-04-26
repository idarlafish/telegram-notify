import type { CreateNotification, Notification, WeekDay } from "./types";
import type { ReminderForm } from "../lib/form-schema";

const PRESET_DAYS: Record<"daily" | "weekdays" | "weekends", WeekDay[]> = {
  daily:    ["mon","tue","wed","thu","fri","sat","sun"],
  weekdays: ["mon","tue","wed","thu","fri"],
  weekends: ["sat","sun"],
};

export function formToApiBody(f: ReminderForm): CreateNotification {
  const base = { time: f.time, timezone: f.timezone, message: f.message };
  if (f.repeat === "one_time") return { ...base, kind: "one_time", date: f.date! };
  const days = f.repeat === "custom" ? f.customDays! : PRESET_DAYS[f.repeat];
  return { ...base, kind: "recurring", days };
}

export function apiRowToForm(n: Notification): ReminderForm {
  const base = { time: n.time, timezone: n.timezone, message: n.message };
  if (n.kind === "one_time") {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: n.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(n.next_fire_at));
    return { ...base, repeat: "one_time", date };
  }
  const days = n.days ?? [];
  const set = new Set(days);
  if (set.size === 7 && PRESET_DAYS.daily.every((d) => set.has(d)))    return { ...base, repeat: "daily" };
  if (set.size === 5 && PRESET_DAYS.weekdays.every((d) => set.has(d))) return { ...base, repeat: "weekdays" };
  if (set.size === 2 && PRESET_DAYS.weekends.every((d) => set.has(d))) return { ...base, repeat: "weekends" };
  return { ...base, repeat: "custom", customDays: days };
}
