"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-bold text-text-body">حدث خطأ غير متوقع</h2>
      <p className="text-sm text-text-muted max-w-md">
        نأسف على الإزعاج. يمكنك إعادة المحاولة، أو تحديث الصفحة إذا استمرت المشكلة.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
