import css from "./ReminderCard.module.css";
export function Skeleton() {
  return (
    <div className={css.card} style={{ background: "rgba(0,0,0,0.06)", color: "transparent" }}>
      <div className={css.time}>00:00</div>
      <div className={css.message}>Loading…</div>
    </div>
  );
}
