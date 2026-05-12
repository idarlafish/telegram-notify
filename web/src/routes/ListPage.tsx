import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications } from "../api/hooks";
import { useMainButton } from "../lib/telegram";
import { ReminderCard } from "../components/ReminderCard";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import css from "./ListPage.module.css";

export default function ListPage() {
  const navigate = useNavigate();
  const q = useNotifications();
  const handleCreate = useCallback(() => {
    navigate({ to: "/new" });
  }, [navigate]);

  useMainButton("Create Reminder", handleCreate);

  if (q.isLoading) {
    return <Loading />;
  }
  if (q.error) {
    return (
      <div className={css.error}>
        Could not load reminders.{" "}
        <button onClick={() => q.refetch()} className={css.retry}>
          Retry
        </button>
      </div>
    );
  }
  const items = q.data?.items ?? [];
  if (items.length === 0) return <EmptyState />;
  return (
    <div className={css.stack}>
      {items.map((n) => (
        <ReminderCard key={n.id} n={n} />
      ))}
    </div>
  );
}
