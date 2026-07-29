import type { ApiResponse, LoginRequest, LoginResponse } from "@/types/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
const REQUEST_TIMEOUT_MS = 30_000;

if (
  !BASE_URL &&
  typeof window !== "undefined" &&
  process.env.NODE_ENV === "production"
) {
  console.error(
    "[api] NEXT_PUBLIC_API_URL is not set. Cross-origin requests will fail. " +
      "Set this env var in your deploy config."
  );
}

// ─── Token helpers ────────────────────────────────────────────────────────────
//
// SECURITY NOTE: access + refresh tokens are stored in localStorage, which is
// XSS-readable. This is a deliberate trade-off for the offline-first PWA flow.
// Migrating to httpOnly cookies requires backend changes (set-cookie on
// login/refresh/logout, CSRF strategy for cross-origin requests since SameSite
// alone isn't enough) — tracked as a separate hardening PR. Until then:
//   - never render untrusted user input via dangerouslySetInnerHTML
//   - keep this token-touching surface confined to api.ts (per CLAUDE.md)

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("_refresh_ts");
}

// ─── Refresh helpers ──────────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

const REFRESH_TS_KEY = "_refresh_ts";
const REFRESH_WINDOW_MS = 10_000;

function normalizeEndpoint(endpoint: string): string {
  const qIdx = endpoint.indexOf("?");
  const path = qIdx === -1 ? endpoint : endpoint.slice(0, qIdx);
  const query = qIdx === -1 ? "" : endpoint.slice(qIdx + 1);
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // ── مزامنة بين التبويبات ──────────────────────────────────────────────────
  // إذا تاب آخر بدأ عملية refresh مؤخراً، انتظر حتى ينتهي بدل ما تعمل refresh ثاني
  if (typeof window !== "undefined") {
    const lastTs = localStorage.getItem(REFRESH_TS_KEY);
    if (lastTs && Date.now() - parseInt(lastTs, 10) < REFRESH_WINDOW_MS) {
      const oldToken = getAccessToken();
      // Poll localStorage every 200ms instead of blocking unconditionally for 10s
      const POLL_MS = 200;
      const maxPolls = Math.ceil(REFRESH_WINDOW_MS / POLL_MS);
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const newToken = getAccessToken();
        if (newToken && newToken !== oldToken) return true;
        if (!localStorage.getItem(REFRESH_TS_KEY)) break;
      }
    }
  }

  // ── singleton داخل نفس التبويب ────────────────────────────────────────────
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (typeof window !== "undefined") {
        localStorage.setItem(REFRESH_TS_KEY, Date.now().toString());
      }

      try {
        const refreshRes = await fetch(`${BASE_URL}/api/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!refreshRes.ok) {
          localStorage.removeItem(REFRESH_TS_KEY);
          if (refreshRes.status === 401 || refreshRes.status === 403) {
            // فشل دائم: التوكن منتهي أو في الـ blacklist → امسح كل شيء
            clearTokens();
          }
          // 5xx أو أي خطأ آخر → فشل مؤقت (سيرفر نايم)، لا نمسح التوكنات
          return false;
        }

        const refreshData = await refreshRes.json() as Record<string, string> | null;

        // ROTATE_REFRESH_TOKENS=True → الرد يحتوي دائماً على refresh جديد
        // إذا لم يأتِ، التوكن القديم في الـ blacklist ولا يمكن استخدامه
        if (!refreshData?.access || !refreshData?.refresh) {
          localStorage.removeItem(REFRESH_TS_KEY);
          return false;
        }

        setTokens(refreshData.access, refreshData.refresh);
        return true;
      } catch {
        localStorage.removeItem(REFRESH_TS_KEY);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

// ─── قراءة وسنفرة رسائل الأخطاء من الردود ───────────────────────────────

export function parseErrorMessage(
  data: unknown,
  fallback: string = "حدث خطأ غير متوقع."
): string {
  if (data === null || data === undefined) {
    return fallback;
  }

  if (typeof data === "string") {
    const cleanText = data.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!cleanText) {
      return fallback;
    }
    return cleanText;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return fallback;
    const itemMessages = data
      .map((item) => parseErrorMessage(item, ""))
      .filter((msg) => msg.length > 0);
    return itemMessages.length > 0 ? itemMessages.join("، ") : fallback;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;

    if (obj.error !== undefined && obj.error !== null) {
      if (typeof obj.error === "string") {
        return parseErrorMessage(obj.error, fallback);
      }
      if (typeof obj.error === "object") {
        const errObj = obj.error as Record<string, unknown>;
        if (errObj.message !== undefined && errObj.message !== null) {
          return parseErrorMessage(errObj.message, fallback);
        }
      }
    }

    if (obj.detail !== undefined && obj.detail !== null) {
      return parseErrorMessage(obj.detail, fallback);
    }

    if (obj.message !== undefined && obj.message !== null) {
      return parseErrorMessage(obj.message, fallback);
    }

    if (obj.non_field_errors !== undefined && obj.non_field_errors !== null) {
      const nonFieldMsg = parseErrorMessage(obj.non_field_errors, "");
      if (nonFieldMsg) return nonFieldMsg;
    }

    if (obj.errors !== undefined && obj.errors !== null) {
      const errorsMsg = parseErrorMessage(obj.errors, "");
      if (errorsMsg) return errorsMsg;
    }

    const entries = Object.entries(obj).filter(
      ([key]) => key !== "error" && key !== "success" && key !== "code" && key !== "status"
    );

    if (entries.length > 0) {
      const fieldMessages: string[] = [];
      for (const [field, val] of entries) {
        if (val === undefined || val === null) continue;
        const msg = parseErrorMessage(val, "");
        if (msg) {
          fieldMessages.push(`${field}: ${msg}`);
        }
      }
      if (fieldMessages.length > 0) {
        return fieldMessages.join("، ");
      }
    }
  }

  return fallback;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const fallback = `حدث خطأ غير متوقع (${res.status}).`;
  try {
    const bodyText = await res.text().catch(() => "");
    if (!bodyText) return fallback;
    try {
      const data = JSON.parse(bodyText);
      return parseErrorMessage(data, fallback);
    } catch {
      return parseErrorMessage(bodyText, fallback);
    }
  } catch {
    return fallback;
  }
}


// ─── Core fetch wrapper ───────────────────────────────────────────────────────

function buildSignal(userSignal: AbortSignal | undefined): AbortSignal {
  // AbortSignal.timeout / .any are available in Node 20+ and modern browsers,
  // which is the supported runtime for Next.js 16.
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!userSignal) return timeoutSignal;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, timeoutSignal]);
  }
  return userSignal;
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> {
  endpoint = normalizeEndpoint(endpoint);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const signal = buildSignal(options.signal ?? undefined);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal,
    });

    // ── معالجة 401 ────────────────────────────────────────────────────────
    if (res.status === 401) {
      //
      // السيناريو الأول: المستخدم كان مسجّل دخول ومنتهية صلاحية التوكن
      // نعرف أن هذا انتهاء جلسة (وليس خطأ credentials) لأن هناك access_token
      //
      if (retry && token) {
        const refreshed = await refreshAccessToken();

        if (refreshed) {
          return apiFetch<T>(endpoint, options, false);
        }

        // الـ refresh فشل
        // إذا مُسحت التوكنات داخل refreshAccessToken (فشل دائم 401/403) → انتهت الجلسة
        // إذا لا تزال التوكنات موجودة (فشل مؤقت 5xx/network) → لا نطرد المستخدم
        const tokensCleared = !getAccessToken();
        if (tokensCleared) {
          if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login")
          ) {
            window.location.href = "/login?reason=session_expired";
          }
          return {
            success: false,
            error: {
              code: 401,
              message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.",
            },
          };
        }

        // فشل مؤقت → أعد الخطأ بدون طرد المستخدم
        return {
          success: false,
          error: {
            code: 0,
            message: "لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت.",
          },
        };
      }

      //
      // السيناريو الثاني: 401 بدون access_token
      // يعني أن الخطأ من السيرفر مباشرة (credentials خاطئة، حساب مقفل، إلخ)
      // اقرأ الرسالة الحقيقية من السيرفر بدل ما تظهر "انتهت الجلسة"
      //
      const message = await extractErrorMessage(res);
      return {
        success: false,
        error: { code: 401, message },
      };
    }

    // ── 204 No Content ─────────────────────────────────────────────────────
    if (res.status === 204) {
      return { success: true, data: {} as T };
    }

    // Read body as text first so a non-JSON response (Django DEBUG HTML page,
    // nginx/Render 502/504 HTML, empty body) surfaces as a real error with the
    // HTTP status, instead of the outer catch swallowing it as "network failed".
    const bodyText = await res.text().catch(() => "");
    let data: unknown = null;
    if (bodyText) {
      try {
        data = JSON.parse(bodyText);
      } catch {
        const cleanSnippet = parseErrorMessage(bodyText, "").slice(0, 200);
        const textSnippet = cleanSnippet ? `. ${cleanSnippet}` : "";
        return {
          success: false,
          error: {
            code: res.status,
            message: `الخادم أعاد استجابة غير صالحة (${res.status}${res.statusText ? " " + res.statusText : ""})${textSnippet}`.trim(),
          },
        };
      }
    }

    const dataObj = (data && typeof data === "object" ? data : null) as {
      success?: unknown;
      error?: { code?: number; message?: string };
    } | null;

    if (res.ok) {
      if (dataObj && dataObj.success !== undefined) return data as ApiResponse<T>;
      return { success: true, data: (data ?? {}) as T };
    }

    // ── أخطاء أخرى (400، 403، 404، 500...) ───────────────────────────────
    const fallbackMessage = `حدث خطأ غير متوقع (${res.status}).`;
    const parsedMessage = parseErrorMessage(
      data ?? bodyText,
      fallbackMessage
    );

    let errorCode = res.status;
    if (
      dataObj?.error &&
      typeof dataObj.error === "object" &&
      typeof dataObj.error.code === "number"
    ) {
      errorCode = dataObj.error.code;
    }

    return {
      success: false,
      error: {
        code: errorCode,
        message: parsedMessage,
      },
    };
  } catch (err: unknown) {
    // Distinguish the timeout signal from a user-initiated abort. Timeout
    // surfaces as DOMException name "TimeoutError"; user abort propagates.
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return {
        success: false,
        error: {
          code: 0,
          message: "انتهت مهلة الطلب. الخادم بطيء أو غير متاح.",
        },
      };
    }
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    // Provide more specific error messages for common issues
    let errorMessage = "لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت.";
    if (err instanceof TypeError) {
      if (err.message.includes('Failed to fetch')) {
        errorMessage = "فشل الاتصال بالخادم. تحقق من اتصال الإنترنت أو أن الخادم يعمل.";
      } else if (err.message.includes('NetworkError')) {
        errorMessage = "خطأ في الشبكة. تحقق من اتصالك بالإنترنت.";
      }
    }
    return {
      success: false,
      error: {
        code: 0,
        message: errorMessage,
      },
    };
  }
}

// ─── Multipart upload ─────────────────────────────────────────────────────────
//
// Separate from apiFetch because the browser must set the multipart boundary
// itself — we cannot send "Content-Type: application/json" the way apiFetch
// always does. Reuses the same 401 → refresh → retry logic so an expired
// access token doesn't drop the upload.

async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  retry = true
): Promise<ApiResponse<T>> {
  endpoint = normalizeEndpoint(endpoint);

  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const signal = buildSignal(undefined);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
      signal,
    });

    if (res.status === 401 && retry && token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return apiUpload<T>(endpoint, formData, false);
      const tokensCleared = !getAccessToken();
      if (tokensCleared) {
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.href = "/login?reason=session_expired";
        }
        return {
          success: false,
          error: { code: 401, message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً." },
        };
      }
      return {
        success: false,
        error: { code: 0, message: "لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت." },
      };
    }

    if (res.status === 204) return { success: true, data: {} as T };

    const bodyText = await res.text().catch(() => "");
    let data: unknown = null;
    if (bodyText) {
      try {
        data = JSON.parse(bodyText);
      } catch {
        const cleanSnippet = parseErrorMessage(bodyText, "").slice(0, 200);
        const textSnippet = cleanSnippet ? `. ${cleanSnippet}` : "";
        return {
          success: false,
          error: {
            code: res.status,
            message: `الخادم أعاد استجابة غير صالحة (${res.status})${textSnippet}`.trim(),
          },
        };
      }
    }

    const dataObj = (data && typeof data === "object" ? data : null) as {
      success?: unknown;
      error?: { code?: number; message?: string };
    } | null;

    if (res.ok) {
      if (dataObj && dataObj.success !== undefined) return data as ApiResponse<T>;
      return { success: true, data: (data ?? {}) as T };
    }

    const fallbackUploadMessage = `حدث خطأ غير متوقع (${res.status}).`;
    const parsedUploadMessage = parseErrorMessage(
      data ?? bodyText,
      fallbackUploadMessage
    );

    let errorCode = res.status;
    if (
      dataObj?.error &&
      typeof dataObj.error === "object" &&
      typeof dataObj.error.code === "number"
    ) {
      errorCode = dataObj.error.code;
    }

    return {
      success: false,
      error: { code: errorCode, message: parsedUploadMessage },
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return {
        success: false,
        error: { code: 0, message: "انتهت مهلة الطلب. الخادم بطيء أو غير متاح." },
      };
    }
    return {
      success: false,
      error: { code: 0, message: "فشل رفع الملف. تحقق من اتصال الإنترنت." },
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function buildQueryString(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const filtered = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (filtered.length === 0) return "";
  return "?" + new URLSearchParams(filtered as [string, string][]).toString();
}

export const api = {
  get<T>(endpoint: string, params?: Record<string, string | undefined>, signal?: AbortSignal) {
    const qs = buildQueryString(params);
    const sep = qs && endpoint.includes("?") ? "&" : "";
    const joined = qs ? endpoint + sep + qs.slice(1) : endpoint;
    return apiFetch<T>(joined, { method: "GET", signal });
  },

  post<T>(endpoint: string, body?: unknown, signal?: AbortSignal) {
    return apiFetch<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  },

  patch<T>(endpoint: string, body?: unknown, signal?: AbortSignal) {
    return apiFetch<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  },

  delete<T>(endpoint: string, signal?: AbortSignal) {
    return apiFetch<T>(endpoint, { method: "DELETE", signal });
  },

  async uploadFile<T>(
    endpoint: string,
    file: File,
    fieldName = "file"
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);
    return apiUpload<T>(endpoint, formData);
  },

  async downloadBlob(endpoint: string): Promise<Blob | null> {
    endpoint = normalizeEndpoint(endpoint);
    const token = getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  },

  // ─── Auth ───────────────────────────────────────────────────────────────

  async login(body: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const res = await apiFetch<LoginResponse>("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.success) {
      setTokens(res.data.access, res.data.refresh);
    }
    return res;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await apiFetch("/api/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh: refreshToken }),
      });
    }
    clearTokens();
  },

  me() {
    return apiFetch<Record<string, unknown>>("/api/auth/me/", {
      method: "GET",
    });
  },

  sendDirectStudentMessage,
};

export interface DirectMessageParams {
  student_id?: string;
  studentId?: string;
  title: string;
  body: string;
}

export interface DirectMessageResponseData {
  student_id: string;
  notifications_created: number;
  recipients_count: number;
}

export async function sendDirectStudentMessage(
  params: DirectMessageParams
): Promise<ApiResponse<DirectMessageResponseData>> {
  const studentId = params.student_id || params.studentId || "";
  const payload = {
    student_id: studentId,
    title: params.title,
    body: params.body,
  };

  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    try {
      const res = await api.post<DirectMessageResponseData>(
        "/api/notifications/direct-message/",
        payload
      );
      if (res.success || (res.error && res.error.code !== 0)) {
        return res;
      }
    } catch {
      // Network failure, fallback to offline outbox queue
    }
  }

  try {
    const { enqueueOp } = await import("@/lib/sync/outbox");
    await enqueueOp({
      resource: "notification",
      action: "direct_message",
      target_id: studentId,
      payload,
      base_updated_at: null,
      client_updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: "تم حفظ الرسالة في صندوق الصادر للمزامنة عند توفر الاتصال.",
      data: {
        student_id: studentId,
        notifications_created: 0,
        recipients_count: 0,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 0,
        message:
          err instanceof Error
            ? err.message
            : "فشل حفظ الرسالة في صندوق الصادر.",
      },
    };
  }
}

