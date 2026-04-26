import css from "./styles.module.css";
import type { Repeat } from "../../lib/form-schema";

const OPTIONS: { value: Repeat; label: string }[] = [
  { value: "repeating", label: "Repeating" },
  { value: "one_time",  label: "One-time" },
];

export function RepeatSelector(props: { value: Repeat; onChange: (v: Repeat) => void }) {
  return (
    <div className={css.row} role="radiogroup" aria-label="Repeat">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" role="radio"
                aria-checked={props.value === o.value}
                data-selected={props.value === o.value}
                className={css.chip}
                onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
