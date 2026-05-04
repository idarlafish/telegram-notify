import * as v from "valibot";

const TimeSchema = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM"));
const TimezoneSchema = v.pipe(v.string(), v.minLength(1));
const MessageSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4000));
const WeekDaySchema = v.picklist(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const DateSchema = v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"));

const RecurringCreate = v.object({
  kind: v.literal("recurring"),
  time: TimeSchema,
  timezone: TimezoneSchema,
  message: MessageSchema,
  days: v.pipe(
    v.array(WeekDaySchema),
    v.minLength(1, "at least one day"),
    v.check((d) => new Set(d).size === d.length, "no duplicate days"),
  ),
});

const OneTimeCreate = v.object({
  kind: v.literal("one_time"),
  time: TimeSchema,
  timezone: TimezoneSchema,
  message: MessageSchema,
  date: DateSchema,
});

export const CreateNotificationSchema = v.variant("kind", [RecurringCreate, OneTimeCreate]);
export type CreateNotificationInput = v.InferOutput<typeof CreateNotificationSchema>;

export const UpdateNotificationSchema = v.partial(
  v.object({
    time: TimeSchema,
    timezone: TimezoneSchema,
    message: MessageSchema,
    days: v.pipe(
      v.array(WeekDaySchema),
      v.minLength(1),
      v.check((d) => new Set(d).size === d.length),
    ),
    date: DateSchema,
  }),
);
export type UpdateNotificationInput = v.InferOutput<typeof UpdateNotificationSchema>;
