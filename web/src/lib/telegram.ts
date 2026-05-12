import { useEffect } from "react";
import type { WebApp } from "@twa-dev/types";

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}

export const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;

export function initTelegram(): void {
  tg?.ready();
  tg?.expand();
}

export function useMainButton(text: string, onClick: () => void) {
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    tg.MainButton.show();
    return () => {
      tg.MainButton.offClick(onClick);
    };
  }, [text, onClick]);
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

export function showAlert(message: string): Promise<void> {
  if (!tg) {
    window.alert(message);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    tg.showAlert(message, () => resolve());
  });
}

export function showConfirm(message: string): Promise<boolean> {
  if (!tg) {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise((resolve) => {
    tg.showConfirm(message, (ok) => resolve(ok));
  });
}

export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
