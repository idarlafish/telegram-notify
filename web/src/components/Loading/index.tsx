import css from "./styles.module.css";

export function Loading() {
  return (
    <div className={css.loading}>
      <div className={css.dot} />
      <div className={css.dot} />
      <div className={css.dot} />
    </div>
  );
}
