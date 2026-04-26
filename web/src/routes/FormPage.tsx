import { useForm } from "@tanstack/react-form";
import { useNavigate, useMatch } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  useCreateNotification, useDeleteNotification, useNotifications, useUpdateNotification,
} from "../api/hooks";
import { ReminderFormSchema, type ReminderForm } from "../lib/form-schema";
import { formToApiBody, apiRowToForm } from "../api/map";
import { useBackButton, useMainButton, getTimezone, haptic } from "../lib/telegram";
import { TimeField } from "../components/TimeField";
import { MessageField } from "../components/MessageField";
import { DateField } from "../components/DateField";
import { RepeatSelector } from "../components/RepeatSelector";
import { DayPicker } from "../components/DayPicker";
import type { WeekDay } from "../api/types";

const DEFAULTS: ReminderForm = {
  time: "09:00", repeat: "daily", message: "", timezone: getTimezone(),
};

// TanStack Form v1 surfaces errors as the standard-schema issue objects
// (`{ message, path }`), not bare strings. Render the message field directly.
function fieldError(errors: unknown[] | undefined): string | undefined {
  const e = errors?.[0];
  if (!e) return undefined;
  if (typeof e === "string") return e;
  if (typeof e === "object" && e && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export default function FormPage() {
  const navigate = useNavigate();
  const editMatch = useMatch({ from: "/edit/$id", shouldThrow: false });
  const editId = editMatch?.params.id;
  const isEdit = !!editId;

  const list = useNotifications();
  const initial = isEdit ? list.data?.items.find((n) => n.id === editId) : undefined;

  const create = useCreateNotification();
  const update = useUpdateNotification();
  const remove = useDeleteNotification();

  const form = useForm({
    defaultValues: initial ? apiRowToForm(initial) : DEFAULTS,
    validators: { onChange: ReminderFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const body = formToApiBody(value);
        if (isEdit && editId) await update.mutateAsync({ id: editId, patch: body });
        else                   await create.mutateAsync(body);
        haptic("success");
        navigate({ to: "/" });
      } catch {
        haptic("error");
        alert("Could not save — please retry");
      }
    },
  });

  // Reset when the edit row finishes loading.
  useEffect(() => {
    if (isEdit && initial) form.reset(apiRowToForm(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, isEdit]);

  useMainButton(isEdit ? "Save" : "Create Reminder", () => form.handleSubmit(), [isEdit]);
  useBackButton(() => navigate({ to: "/" }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <h1 style={{ fontSize: 22, marginBottom: 18 }}>
        {isEdit ? "Edit reminder" : "New reminder"}
      </h1>

      <form.Field name="time">{(f) => (
        <TimeField value={f.state.value} onChange={f.handleChange}
          error={fieldError(f.state.meta.errors)} />
      )}</form.Field>

      <form.Field name="repeat">{(f) => (
        <>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".5px", opacity: .7, marginBottom: 6 }}>
            Repeat
          </div>
          <RepeatSelector value={f.state.value} onChange={(v) => {
            f.handleChange(v);
            if (v !== "custom") form.setFieldValue("customDays", undefined);
            if (v !== "one_time") form.setFieldValue("date", undefined);
          }} />
        </>
      )}</form.Field>

      <form.Subscribe selector={(s) => s.values.repeat}>
        {(repeat) => (
          <>
            {repeat === "custom" && (
              <form.Field name="customDays">{(f) => (
                <>
                  <DayPicker value={(f.state.value ?? []) as WeekDay[]}
                    onChange={(v) => f.handleChange(v)} />
                  {fieldError(f.state.meta.errors) && (
                    <div style={{ color: "#d73a3a", fontSize: 13, marginTop: -8, marginBottom: 12 }}>
                      {fieldError(f.state.meta.errors)}
                    </div>
                  )}
                </>
              )}</form.Field>
            )}
            {repeat === "one_time" && (
              <form.Field name="date">{(f) => (
                <DateField value={f.state.value ?? ""} onChange={f.handleChange}
                  error={fieldError(f.state.meta.errors)} />
              )}</form.Field>
            )}
          </>
        )}
      </form.Subscribe>

      <form.Field name="message">{(f) => (
        <MessageField value={f.state.value} onChange={f.handleChange}
          error={fieldError(f.state.meta.errors)} />
      )}</form.Field>

      {isEdit && (
        <button type="button"
          onClick={() => {
            if (!editId) return;
            if (!confirm("Delete this reminder?")) return;
            remove.mutate(editId, { onSuccess: () => navigate({ to: "/" }) });
          }}
          style={{
            marginTop: 16, padding: "12px 16px", width: "100%",
            background: "rgba(215,58,58,0.12)", color: "#d73a3a",
            border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer",
          }}>
          Delete
        </button>
      )}
    </form>
  );
}
