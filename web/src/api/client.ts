import { getInitData } from "../lib/telegram";
import type { Notification, CreateNotification, UpdateNotification } from "./types";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      Authorization: `tma ${getInitData()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({ message: r.statusText }));
    throw new Error((body as { message?: string }).message ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  list: (): Promise<{ items: Notification[] }> => {
    if (window.__notificationsPromise) {
      const p = window.__notificationsPromise as Promise<{ items: Notification[] }>;
      window.__notificationsPromise = undefined;
      return p;
    }
    return req<{ items: Notification[] }>("/notifications");
  },
  create: (body: CreateNotification) =>
    req<{ notification: Notification }>("/notifications", {
      method: "POST", body: JSON.stringify(body),
    }),
  update: (id: string, patch: UpdateNotification) =>
    req<{ notification: Notification }>(`/notifications/${id}`, {
      method: "PATCH", body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    req<{ ok: true }>(`/notifications/${id}`, { method: "DELETE" }),
};
