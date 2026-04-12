import type { ApiResponse, LoginRequest, LoginResponse } from "@/types/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Token helpers ────────────────────────────────────────────────────────────

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
  const [path, query = ""] = endpoint.split("?");
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
      // انتظر حتى نهاية النافذة الزمنية ليتأكد أن التاب الثاني أنهى الـ refresh
      await new Promise((r) => setTimeout(r, REFRESH_WINDOW_MS));
      const newToken = getAccessToken();
      // إذا تغير التوكن → الـ refresh نجح في تاب آخر
      if (newToken && newToken !== oldToken) return true;
      // إذا لم يتغير → نسمح لهذا التاب يحاول بنفسه
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

// ─── قراءة رسالة الخطأ الحقيقية من رد السيرفر ───────────────────────────────

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return (
      body?.detail ||
      body?.message ||
      body?.error?.message ||
      body?.non_field_errors?.[0] ||
      "حدث خطأ غير متوقع."
    );
  } catch {
    return "حدث خطأ غير متوقع.";
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

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

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
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

    const data = await res.json();

    if (res.ok) {
      if (data.success !== undefined) return data as ApiResponse<T>;
      return { success: true, data: data as T };
    }

    // ── أخطاء أخرى (400، 403، 404، 500...) ───────────────────────────────
    if (data.error) {
      return { success: false, error: data.error };
    }
    return {
      success: false,
      error: {
        code: res.status,
        message: data.detail || data.message || "حدث خطأ غير متوقع.",
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: 0,
        message: "لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت.",
      },
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
  get<T>(endpoint: string, params?: Record<string, string | undefined>) {
    return apiFetch<T>(endpoint + buildQueryString(params), { method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown) {
    return apiFetch<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown) {
    return apiFetch<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(endpoint: string) {
    return apiFetch<T>(endpoint, { method: "DELETE" });
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
};
