import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { CreateNotification, Notification, UpdateNotification } from "./types";

export const notificationsKey = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => api.list(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNotification) => api.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useUpdateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateNotification }) =>
      api.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationsKey });
      const prev = qc.getQueryData<{ items: Notification[] }>(notificationsKey);
      if (prev) {
        qc.setQueryData<{ items: Notification[] }>(notificationsKey, {
          items: prev.items.filter((n) => n.id !== id),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationsKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}
