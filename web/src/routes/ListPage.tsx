import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications } from "../api/hooks";
import { useMainButton } from "../lib/telegram";
import { ReminderCard } from "../components/ReminderCard";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";

export default function ListPage() {
  const navigate = useNavigate();
  const q = useNotifications();
  const [, setTick] = useState(0);

  useMainButton("Create Reminder", () => navigate({ to: "/new" }), []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (q.isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }
  if (q.error) {
    return (
      <div style={{ background: "rgba(255,0,0,0.08)", padding: 14, borderRadius: 8 }}>
        Could not load reminders.{" "}
        <button onClick={() => q.refetch()} style={{ marginLeft: 8 }}>
          Retry
        </button>
      </div>
    );
  }
  const items = q.data?.items ?? [];
  if (items.length === 0) return <EmptyState />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((n) => (
        <ReminderCard key={n.id} n={n} />
      ))}
    </div>
  );
}
