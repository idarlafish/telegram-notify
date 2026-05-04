export function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>
      <div style={{ fontSize: 16, opacity: 0.7 }}>
        No reminders yet.
        <br />
        Tap the button below to create one!
      </div>
    </div>
  );
}
