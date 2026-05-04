import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDeleteNotification, useNotifications, notificationsKey } from "../src/api/hooks";
import type { Notification } from "../src/api/types";

const SAMPLE: Notification[] = [
  {
    id: "a",
    kind: "recurring",
    message: "x",
    time: "09:00",
    timezone: "UTC",
    days: ["mon"],
    next_fire_at: 0,
    last_sent_at: null,
    created_at: 0,
  },
  {
    id: "b",
    kind: "recurring",
    message: "y",
    time: "10:00",
    timezone: "UTC",
    days: ["tue"],
    next_fire_at: 0,
    last_sent_at: null,
    created_at: 0,
  },
];

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  // Stub Telegram WebApp absence — useTelegram returns null in tests.
  vi.stubGlobal("Telegram", undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function methodOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.method : "GET";
}

describe("useDeleteNotification", () => {
  it("removes the row and keeps it removed on success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/notifications") && methodOf(input) === "GET") {
        // After invalidation, return the list MINUS the deleted row.
        return new Response(JSON.stringify({ items: SAMPLE.filter((n) => n.id !== "a") }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(notificationsKey, { items: SAMPLE });

    // Pre-prime so the "list" query is registered (otherwise invalidate is a no-op).
    renderHook(() => useNotifications(), { wrapper: wrapper(qc) });

    const { result } = renderHook(() => useDeleteNotification(), { wrapper: wrapper(qc) });

    result.current.mutate("a");

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    await waitFor(() => {
      const cached = qc.getQueryData<{ items: Notification[] }>(notificationsKey);
      expect(cached?.items.map((n) => n.id)).toEqual(["b"]);
    });
  });

  it("rolls back the optimistic removal when the server errors", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/notifications") && methodOf(input) === "GET") {
        // The server didn't actually delete, so the canonical list still has both rows.
        return new Response(JSON.stringify({ items: SAMPLE }), { status: 200 });
      }
      // DELETE → 500
      return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    qc.setQueryData(notificationsKey, { items: SAMPLE });
    renderHook(() => useNotifications(), { wrapper: wrapper(qc) });

    const { result } = renderHook(() => useDeleteNotification(), { wrapper: wrapper(qc) });

    // mutateAsync awaits the full lifecycle: onMutate → mutationFn → onError → onSettled.
    // The promise rejects on error; by the time it settles, onError has run synchronously.
    await expect(result.current.mutateAsync("a")).rejects.toThrow();

    const cached = qc.getQueryData<{ items: Notification[] }>(notificationsKey);
    expect(cached?.items.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });
});
