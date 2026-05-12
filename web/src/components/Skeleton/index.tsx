import cardCss from "../ReminderCard/styles.module.css";
import css from "./styles.module.css";

export function Skeleton() {
  return (
    <div className={`${cardCss.card} ${css.skeleton}`}>
      <div className={cardCss.time}>00:00</div>
      <div className={cardCss.message}>Loading…</div>
    </div>
  );
}
