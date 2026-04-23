/**
 * Initial full-DB download for a brand-new device. Streams the
 * `/api/sync/pull/` response with a ReadableStream reader so we can show
 * byte-level progress. After the download completes, the JSON is parsed
 * and handed to the same `applyPullResponse` helper used by delta pulls.
 *
 * This intentionally bypasses `src/lib/api.ts`'s apiFetch wrapper because
 * that wrapper consumes the response body with `.text()` and gives us no
 * hook for progress. Token refresh is NOT attempted here — if the token
 * has expired the user must re-login online.
 */

import { hasSessionKey } from "../db/auth";

import { applyPullResponse, type SyncPullResponse } from "./pull";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Abort the fetch / stream read if headers don't arrive within this
// window, or if no chunk arrives within STALL_TIMEOUT_MS between chunks.
// Without these the browser will wait forever on a silent half-closed
// connection — exactly the "hangs at 0%" symptom this file is fixing.
const HEADERS_TIMEOUT_MS = 60_000;
const STALL_TIMEOUT_MS = 30_000;

export type DownloadPhase = "downloading" | "saving" | "done" | "error";

export interface DownloadProgress {
  phase: DownloadPhase;
  /** 0..1, -1 when indeterminate (server didn't send Content-Length). */
  percent: number;
  /** For `saving` phase: 1-based step index across resource tables. */
  table?: string;
  tableIndex?: number;
  tableTotal?: number;
  error?: string;
}

export interface DownloadResult {
  ok: boolean;
  error?: string;
}

export async function downloadFullDb(
  onProgress: (p: DownloadProgress) => void
): Promise<DownloadResult> {
  if (!hasSessionKey()) {
    console.error("[download] session locked — DB key not in memory");
    return { ok: false, error: "تعذّر تنزيل البيانات: الجلسة مقفلة." };
  }

  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  if (!token) {
    console.error("[download] no access token in localStorage");
    return { ok: false, error: "يجب تسجيل الدخول أولاً." };
  }

  const controller = new AbortController();
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const armWatchdog = (ms: number, label: string) => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      console.error(`[download] watchdog fired: ${label} (${ms}ms)`);
      controller.abort();
    }, ms);
  };
  const disarmWatchdog = () => {
    if (watchdog !== null) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  let res: Response;
  try {
    armWatchdog(HEADERS_TIMEOUT_MS, "awaiting response headers");
    res = await fetch(`${BASE_URL}/api/sync/pull/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch (err) {
    disarmWatchdog();
    const aborted = (err as { name?: string })?.name === "AbortError";
    console.error("[download] fetch failed:", err);
    return {
      ok: false,
      error: aborted
        ? "انتهت مهلة الاتصال بالخادم. حاول مرة أخرى."
        : `فشل الاتصال بالخادم: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!res.ok) {
    disarmWatchdog();
    console.error(`[download] server returned ${res.status}`);
    return { ok: false, error: `خطأ من الخادم (${res.status}).` };
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body?.getReader();

  let bodyText: string;
  if (!reader) {
    // Some environments (older Safari in test harnesses) expose no reader;
    // fall back to .text() and report indeterminate progress.
    onProgress({ phase: "downloading", percent: -1 });
    try {
      armWatchdog(HEADERS_TIMEOUT_MS, "reading body via .text()");
      bodyText = await res.text();
    } catch (err) {
      disarmWatchdog();
      console.error("[download] res.text() failed:", err);
      return {
        ok: false,
        error: "فشل قراءة الاستجابة من الخادم. حاول مرة أخرى.",
      };
    }
    disarmWatchdog();
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    onProgress({ phase: "downloading", percent: contentLength > 0 ? 0 : -1 });
    // Read the body stream to completion, emitting progress periodically.
    // JSON cannot be incrementally parsed without a streaming-JSON lib, so
    // we accumulate chunks and parse once complete. Each chunk rearms the
    // stall watchdog so a silent connection can't hang us forever.
    try {
      for (;;) {
        armWatchdog(STALL_TIMEOUT_MS, "awaiting next chunk");
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          const percent = contentLength > 0 ? received / contentLength : -1;
          onProgress({ phase: "downloading", percent });
        }
      }
    } catch (err) {
      disarmWatchdog();
      const aborted = (err as { name?: string })?.name === "AbortError";
      console.error("[download] stream read failed:", err);
      return {
        ok: false,
        error: aborted
          ? "انقطع تنزيل البيانات. حاول مرة أخرى."
          : `تعذّرت قراءة البيانات: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    disarmWatchdog();
    const decoder = new TextDecoder("utf-8");
    bodyText = chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  }

  let parsed: SyncPullResponse;
  try {
    const envelope = JSON.parse(bodyText) as
      | { success: boolean; data: SyncPullResponse }
      | SyncPullResponse;
    // The backend wraps its response in `{success, data}`. The regular
    // pullSync uses `api.get()` which auto-unwraps `.data`, but this raw
    // fetch doesn't — so we must handle both shapes defensively.
    parsed = "data" in envelope && (envelope as { data?: unknown }).data != null
      ? (envelope as { data: SyncPullResponse }).data
      : (envelope as SyncPullResponse);
  } catch (err) {
    console.error("[download] JSON.parse failed:", err);
    return { ok: false, error: "الاستجابة من الخادم غير صالحة." };
  }

  try {
    onProgress({ phase: "saving", percent: 0 });
    await applyPullResponse(parsed, (table, done, total) => {
      onProgress({
        phase: "saving",
        percent: done / total,
        table,
        tableIndex: done,
        tableTotal: total,
      });
    });
    onProgress({ phase: "done", percent: 1 });
    return { ok: true };
  } catch (err) {
    console.error("[download] applyPullResponse failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `فشل حفظ البيانات محلياً: ${message}` };
  }
}
