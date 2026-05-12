import css from "./styles.module.css";

export function EmptyState() {
  return (
    <div className={css.empty}>
      <div className={css.icon}>⏰</div>
      <div className={css.text}>
        No reminders yet.
        <br />
        Tap the button below to create one!
      </div>
    </div>
  );
}
