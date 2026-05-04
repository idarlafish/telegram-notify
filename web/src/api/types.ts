export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Notification = {
  id: string;
  kind: "recurring" | "one_time";
  message: string;
  time: string;
  timezone: string;
  days?: WeekDay[];
  next_fire_at: number;
  last_sent_at: number | null;
  created_at: number;
};

export type CreateRecurring = {
  kind: "recurring";
  time: string;
  timezone: string;
  message: string;
  days: WeekDay[];
};
export type CreateOneTime = {
  kind: "one_time";
  time: string;
  timezone: string;
  message: string;
  date: string;
};
export type CreateNotification = CreateRecurring | CreateOneTime;

export type UpdateNotification = Partial<{
  time: string;
  timezone: string;
  message: string;
  days: WeekDay[];
  date: string;
}>;
