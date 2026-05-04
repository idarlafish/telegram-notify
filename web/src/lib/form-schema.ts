import * as v from "valibot";
import type { WeekDay } from "../api/types";

const WeekDaySchema = v.picklist(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const ONE_TIME_FUTURE_ERROR = "pick a future date/time";

export const ReminderFormSchema = v.pipe(
  v.object({
    time: v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM")),
    repeat: v.picklist(["repeating", "one_time"]),
    days: v.optional(v.array(WeekDaySchema)),
    date: v.optional(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/))),
    message: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "required"),
      v.maxLength(200, "max 200 chars"),
    ),
    timezone: v.string(),
  }),
  v.check((d) => d.repeat !== "repeating" || (d.days?.length ?? 0) > 0, "pick at least one day"),
  v.check((d) => d.repeat !== "one_time" || !!d.date, "pick a date"),
  v.forward(
    v.check((d) => {
      if (d.repeat !== "one_time" || !d.date) return true;
      const oneTimeAt = new Date(`${d.date}T${d.time}:00`);
      if (Number.isNaN(oneTimeAt.getTime())) return true;
      return oneTimeAt.getTime() > Date.now();
    }, ONE_TIME_FUTURE_ERROR),
    ["date"],
  ),
);

export type ReminderForm = v.InferOutput<typeof ReminderFormSchema>;
export type Repeat = ReminderForm["repeat"];
export type { WeekDay };
