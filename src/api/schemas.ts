import * as v from "valibot";

export const CreateNotificationSchema = v.object({
  time: v.pipe(
    v.string(),
    v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM"),
  ),
  timezone: v.pipe(v.string(), v.minLength(1)),
  message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(4000)),
});

export type CreateNotificationInput = v.InferOutput<typeof CreateNotificationSchema>;
