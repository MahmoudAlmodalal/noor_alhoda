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
    return { ok: false, error: "DB session locked" };
  }

  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  if (!token) {
    return { ok: false, error: "يجب تسجيل الدخول أولاً." };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/sync/pull/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `فشل الاتصال بالخادم: ${message}` };
  }

  if (!res.ok) {
    return { ok: false, error: `خطأ من الخادم (${res.status}).` };
  }

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body?.getReader();

  let bodyText: string;
  if (!reader) {
    // Some environments (older Safari in test harnesses) expose no reader;
    // fall back to .text() and report indeterminate progress.
    onProgress({ phase: "downloading", percent: -1 });
    bodyText = await res.text();
  } else {
    const chunks: Uint8Array[] = [];
    let received = 0;
    onProgress({ phase: "downloading", percent: contentLength > 0 ? 0 : -1 });
    // Read the body stream to completion, emitting progress periodically.
    // JSON cannot be incrementally parsed without a streaming-JSON lib, so
    // we accumulate chunks and parse once complete.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        const percent = contentLength > 0 ? received / contentLength : -1;
        onProgress({ phase: "downloading", percent });
      }
    }
    const decoder = new TextDecoder("utf-8");
    bodyText = chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  }

  let parsed: SyncPullResponse;
  try {
    parsed = JSON.parse(bodyText) as SyncPullResponse;
  } catch {
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
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `فشل حفظ البيانات محلياً: ${message}` };
  }
}
