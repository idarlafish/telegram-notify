import css from "./styles.module.css";
import type { WeekDay } from "../../api/types";

const DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ALL: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKENDS: WeekDay[] = ["sat", "sun"];

export function DayPicker(props: { value: WeekDay[]; onChange: (v: WeekDay[]) => void }) {
  const set = new Set(props.value);

  function toggle(d: WeekDay) {
    const next = new Set(set);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    props.onChange(DAYS.filter((x) => next.has(x)));
  }

  function isExact(preset: WeekDay[]) {
    return set.size === preset.length && preset.every((d) => set.has(d));
  }

  return (
    <>
      <div className={css.presets} role="group" aria-label="Day presets">
        <button
          type="button"
          className={css.preset}
          data-selected={isExact(ALL)}
          onClick={() => props.onChange([...ALL])}
        >
          Daily
        </button>
        <button
          type="button"
          className={css.preset}
          data-selected={isExact(WEEKDAYS)}
          onClick={() => props.onChange([...WEEKDAYS])}
        >
          Weekdays
        </button>
        <button
          type="button"
          className={css.preset}
          data-selected={isExact(WEEKENDS)}
          onClick={() => props.onChange([...WEEKENDS])}
        >
          Weekends
        </button>
      </div>
      <div className={css.row} role="group" aria-label="Days">
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            data-selected={set.has(d)}
            className={css.day}
            onClick={() => toggle(d)}
          >
            {d[0]!.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
