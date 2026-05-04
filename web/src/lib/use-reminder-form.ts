import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  useCreateNotification,
  useDeleteNotification,
  useNotifications,
  useUpdateNotification,
} from "../api/hooks";
import { ReminderFormSchema, type ReminderForm } from "./form-schema";
import { ALL_DAYS, apiRowToForm, formToApiBody } from "../api/map";
import { getTimezone, haptic } from "./telegram";

const DEFAULTS: ReminderForm = {
  time: "09:00",
  repeat: "repeating",
  days: [...ALL_DAYS],
  message: "",
  timezone: getTimezone(),
};

// Encapsulates the create/edit form lifecycle: defaults, edit-row prefill,
// submit (mutation choice based on mode), and delete (edit-only).
// Returns just the surfaces a render needs — no React tree manipulation.
export function useReminderForm(editId: string | undefined) {
  const navigate = useNavigate();
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
        else await create.mutateAsync(body);
        haptic("success");
        navigate({ to: "/" });
      } catch (e) {
        haptic("error");
        alert(e instanceof Error ? e.message : "Could not save — please retry");
      }
    },
  });

  // Edit-mode prefill arrives async (list query); reset the form once it lands.
  useEffect(() => {
    if (isEdit && initial) form.reset(apiRowToForm(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, isEdit]);

  function handleDelete() {
    if (!editId) return;
    if (!confirm("Delete this reminder?")) return;
    remove.mutate(editId, { onSuccess: () => navigate({ to: "/" }) });
  }

  return { form, isEdit, handleDelete };
}
