import type { WeekDay } from "./mappers";

export type Profile = { chat_id: number; created_at: number };

export type RecurringInput = {
  kind: "recurring";
  time: string;
  timezone: string;
  message: string;
  days: WeekDay[];
};

export type OneTimeInput = {
  kind: "one_time";
  time: string;
  timezone: string;
  message: string;
  date: string;
};

export type NotificationInput = RecurringInput | OneTimeInput;

export type UpdateInput = Partial<{
  time: string;
  timezone: string;
  message: string;
  days: WeekDay[];
  date: string;
}>;

export type Notification = {
  id: string;
  kind: "recurring" | "one_time";
  time: string;
  timezone: string;
  message: string;
  days?: WeekDay[];
  date?: string;
  next_fire_at: number;
  last_sent_at: number | null;
  created_at: number;
};
