import css from "./fields.module.css";
export function MessageField(props: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor="message">Message</label>
      <textarea id="message" className={css.textarea}
                placeholder="What should I remind you about?"
                maxLength={200}
                value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.error && <div className={css.error}>{props.error}</div>}
    </div>
  );
}
