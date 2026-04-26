import css from "./DayPicker.module.css";
import type { WeekDay } from "../api/types";

const DAYS: WeekDay[] = ["mon","tue","wed","thu","fri","sat","sun"];

export function DayPicker(props: { value: WeekDay[]; onChange: (v: WeekDay[]) => void }) {
  const set = new Set(props.value);
  function toggle(d: WeekDay) {
    const next = new Set(set);
    if (next.has(d)) next.delete(d); else next.add(d);
    props.onChange(DAYS.filter((x) => next.has(x)));
  }
  return (
    <div className={css.row} role="group" aria-label="Days">
      {DAYS.map((d) => (
        <button key={d} type="button" data-selected={set.has(d)}
                className={css.day} onClick={() => toggle(d)}>
          {d[0]!.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
