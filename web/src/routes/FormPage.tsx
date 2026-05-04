import { useCallback } from "react";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { useReminderForm } from "../lib/use-reminder-form";
import { fieldError } from "../lib/field-error";
import { ALL_DAYS } from "../api/map";
import { useBackButton, useMainButton } from "../lib/telegram";
import { TimeField } from "../components/TimeField";
import { MessageField } from "../components/MessageField";
import { DateField } from "../components/DateField";
import { RepeatSelector } from "../components/RepeatSelector";
import { DayPicker } from "../components/DayPicker";
import type { WeekDay } from "../api/types";

export default function FormPage() {
  const navigate = useNavigate();
  const editMatch = useMatch({ from: "/edit/$id", shouldThrow: false });
  const editId = editMatch?.params.id;
  const { form, isEdit, handleDelete } = useReminderForm(editId);
  const handleMainButtonClick = useCallback(() => {
    form.handleSubmit();
  }, [form]);
  const handleBackClick = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  useMainButton(isEdit ? "Save" : "Create Reminder", handleMainButtonClick);
  useBackButton(handleBackClick);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 18 }}>
        {isEdit ? "Edit reminder" : "New reminder"}
      </h1>

      <form.Field name="time">
        {(f) => (
          <TimeField
            value={f.state.value}
            onChange={f.handleChange}
            error={fieldError(f.state.meta.errors)}
          />
        )}
      </form.Field>

      <form.Field name="repeat">
        {(f) => (
          <>
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: ".5px",
                opacity: 0.7,
                marginBottom: 6,
              }}
            >
              Repeat
            </div>
            <RepeatSelector
              value={f.state.value}
              onChange={(v) => {
                f.handleChange(v);
                if (v === "repeating") {
                  if (!form.getFieldValue("days")?.length)
                    form.setFieldValue("days", [...ALL_DAYS]);
                  form.setFieldValue("date", undefined);
                } else {
                  form.setFieldValue("days", undefined);
                  if (!form.getFieldValue("date")) {
                    form.setFieldValue(
                      "date",
                      new Intl.DateTimeFormat("en-CA", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }).format(new Date()),
                    );
                  }
                }
              }}
            />
          </>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.repeat}>
        {(repeat) => (
          <>
            {repeat === "repeating" && (
              <form.Field name="days">
                {(f) => (
                  <>
                    <DayPicker
                      value={(f.state.value ?? []) as WeekDay[]}
                      onChange={(v) => f.handleChange(v)}
                    />
                    {fieldError(f.state.meta.errors) && (
                      <div
                        style={{ color: "#d73a3a", fontSize: 13, marginTop: -8, marginBottom: 12 }}
                      >
                        {fieldError(f.state.meta.errors)}
                      </div>
                    )}
                  </>
                )}
              </form.Field>
            )}
            {repeat === "one_time" && (
              <form.Field name="date">
                {(f) => (
                  <DateField
                    value={f.state.value ?? ""}
                    onChange={f.handleChange}
                    error={fieldError(f.state.meta.errors)}
                  />
                )}
              </form.Field>
            )}
          </>
        )}
      </form.Subscribe>

      <form.Field name="message">
        {(f) => (
          <MessageField
            value={f.state.value}
            onChange={f.handleChange}
            error={fieldError(f.state.meta.errors)}
          />
        )}
      </form.Field>

      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          style={{
            marginTop: 16,
            padding: "12px 16px",
            width: "100%",
            background: "rgba(215,58,58,0.12)",
            color: "#d73a3a",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      )}
    </form>
  );
}
