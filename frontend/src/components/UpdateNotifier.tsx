"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export function UpdateNotifier() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    });
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-8 md:w-80">
      <div className="bg-primary text-white p-4 rounded-2xl shadow-2xl border border-white/20 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">تحديث جديد متاح</p>
            <p className="text-xs text-white/80 mt-0.5">يتوفر إصدار جديد من التطبيق مع تحسينات وميزات جديدة.</p>
          </div>
        </div>
        <button
          onClick={() => {
            waitingWorker.postMessage({ type: "SKIP_WAITING" });
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              window.location.reload();
            });
          }}
          className="w-full bg-white text-primary font-bold py-2.5 rounded-xl text-sm hover:bg-white/90 transition-colors"
        >
          تحديث الآن
        </button>
      </div>
    </div>
  );
}
