import { useEffect } from "react";
import type { WebApp } from "@twa-dev/types";

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
    __notificationsPromise?: Promise<{ items: unknown[] }>;
  }
}

export const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;

export function initTelegram(): void {
  tg?.ready();
  tg?.expand();
}

export function useMainButton(text: string, onClick: () => void, deps: unknown[]) {
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    tg.MainButton.show();
    return () => {
      tg.MainButton.offClick(onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useBackButton(onClick: () => void) {
  useEffect(() => {
    if (!tg) return;
    tg.BackButton.onClick(onClick);
    tg.BackButton.show();
    return () => {
      tg.BackButton.offClick(onClick);
      tg.BackButton.hide();
    };
  }, [onClick]);
}

export function haptic(kind: "success" | "warning" | "error") {
  tg?.HapticFeedback?.notificationOccurred(kind);
}

export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
