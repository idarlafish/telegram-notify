import css from "./fields.module.css";
export function DateField(props: { value: string; onChange: (v: string) => void; error?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor="date">Date</label>
      <input id="date" type="date" min={today} className={css.input}
             value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.error && <div className={css.error}>{props.error}</div>}
    </div>
  );
}
