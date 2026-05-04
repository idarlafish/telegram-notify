import type { CreateNotification, Notification, WeekDay } from "./types";
import type { ReminderForm } from "../lib/form-schema";

export const ALL_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function formToApiBody(f: ReminderForm): CreateNotification {
  const base = { time: f.time, timezone: f.timezone, message: f.message };
  if (f.repeat === "one_time") return { ...base, kind: "one_time", date: f.date! };
  return { ...base, kind: "recurring", days: f.days! };
}

export function apiRowToForm(n: Notification): ReminderForm {
  const base = { time: n.time, timezone: n.timezone, message: n.message };
  if (n.kind === "one_time") {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: n.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(n.next_fire_at));
    return { ...base, repeat: "one_time", date };
  }
  return { ...base, repeat: "repeating", days: n.days ?? [] };
}
