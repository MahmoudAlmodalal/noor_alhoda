"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISSED_KEY = "install_dismissed_at";
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      return; // already installed
    }

    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const handler = (ev: Event) => {
      ev.preventDefault();
      setDeferred(ev as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
  }, []);

  if (!visible || !deferred) return null;

  const onInstall = async () => {
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setDeferred(null);
      setVisible(false);
    }
  };

  const onDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 start-4 end-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text-title">
            ثبّت تطبيق نور الهدى على جهازك
          </h3>
          <p className="mt-1 text-xs text-text-label">
            للوصول السريع والعمل دون اتصال بالإنترنت.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onInstall}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              تثبيت
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-bold text-text-body hover:bg-surface-subtle"
            >
              لاحقاً
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-body"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
