import css from "./fields.module.css";
export function TimeField(props: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor="time">Time</label>
      <input id="time" type="time" className={css.input}
             value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.error && <div className={css.error}>{props.error}</div>}
    </div>
  );
}
