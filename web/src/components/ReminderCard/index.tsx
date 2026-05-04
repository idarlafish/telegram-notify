import { useNavigate } from "@tanstack/react-router";
import type { Notification } from "../../api/types";
import { formatLocalTime, daysSummary, countdownText } from "../../lib/time";
import css from "./styles.module.css";
import sunriseUrl from "../../assets/sunrise.svg";
import sunUrl from "../../assets/sun.svg";
import sunsetUrl from "../../assets/sunset.svg";
import moonUrl from "../../assets/moon.svg";

type Period = "morning" | "day" | "evening" | "night";

function periodOf(time: string): Period {
  const h = Number(time.split(":")[0] ?? 0);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function iconOf(period: Period): string {
  switch (period) {
    case "morning":
      return sunriseUrl;
    case "day":
      return sunUrl;
    case "evening":
      return sunsetUrl;
    case "night":
      return moonUrl;
  }
}

function summary(n: Notification): string {
  if (n.kind === "one_time") {
    const d = new Intl.DateTimeFormat("en-GB", {
      timeZone: n.timezone,
      day: "numeric",
      month: "short",
    }).format(new Date(n.next_fire_at));
    return `Once on ${d}`;
  }
  return daysSummary(n.days ?? []);
}

export function ReminderCard({ n }: { n: Notification }) {
  const navigate = useNavigate();
  const period = periodOf(n.time);
  return (
    <div
      className={`gradient ${css.card}`}
      data-period={period}
      onClick={() => navigate({ to: "/edit/$id", params: { id: n.id } })}
    >
      <img className={css.icon} src={iconOf(period)} alt="" />
      <div className={css.time}>{formatLocalTime(n.next_fire_at, n.timezone)}</div>
      <div className={css.message}>{n.message}</div>
      <div className={css.foot}>
        <span>{summary(n)}</span>
        <span>{countdownText(n.next_fire_at)}</span>
      </div>
    </div>
  );
}
