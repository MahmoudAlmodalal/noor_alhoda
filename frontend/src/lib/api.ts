import type { ApiResponse, LoginRequest, LoginResponse } from "@/types/api";

// In production, we use relative paths to avoid CORS issues and ensure same-origin requests.
// NEXT_PUBLIC_API_URL is only used if we need to point to a different domain.
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
  // أيضاً امسح مؤشر الـ refresh حتى لا يتعارض مع التبويبات الأخرى
  localStorage.removeItem("_refresh_ts");
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

// مفتاح مزامنة الـ refresh بين التبويبات المتعددة
const REFRESH_TS_KEY = "_refresh_ts";
// نافذة زمنية (ms) نعتبر فيها أن تبويباً آخر قام بالـ refresh مؤخراً
const REFRESH_WINDOW_MS = 4_000;

function normalizeEndpoint(endpoint: string): string {
  const [path, query = ""] = endpoint.split("?");
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // ── مزامنة بين التبويبات ──────────────────────────────────────────────────
  // إذا كان تبويب آخر قام بالـ refresh مؤخراً (< REFRESH_WINDOW_MS)،
  // انتظر قليلاً ثم استخدم الـ token الجديد الذي خزّنه ذلك التبويب.
  if (typeof window !== "undefined") {
    const lastTs = localStorage.getItem(REFRESH_TS_KEY);
    if (lastTs && Date.now() - parseInt(lastTs, 10) < REFRESH_WINDOW_MS) {
      await new Promise((r) => setTimeout(r, REFRESH_WINDOW_MS / 2));
      // بعد الانتظار، إذا يوجد access token جديد صالح اعتبره نجاحاً
      return !!getAccessToken();
    }
  }

  // ── singleton داخل نفس التبويب ────────────────────────────────────────────
  if (!refreshPromise) {
    refreshPromise = (async () => {
      // سجّل الطابع الزمني قبل الطلب لحجب التبويبات الأخرى
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
          // الـ refresh token منتهي أو محظور — امسح الـ timestamp
          if (typeof window !== "undefined") {
            localStorage.removeItem(REFRESH_TS_KEY);
          }
          return false;
        }

        const refreshData = await refreshRes.json();

        // ROTATE_REFRESH_TOKENS=True يُرجع refresh token جديد دائماً؛
        // إذا لم يأتِ في الرد (خطأ في الـ backend)، نعتبر العملية فاشلة
        // لأن الـ token القديم أصبح في الـ blacklist.
        if (!refreshData.access || !refreshData.refresh) {
          if (typeof window !== "undefined") {
            localStorage.removeItem(REFRESH_TS_KEY);
          }
          return false;
        }

        setTokens(refreshData.access, refreshData.refresh);
        return true;
      } catch {
        if (typeof window !== "undefined") {
          localStorage.removeItem(REFRESH_TS_KEY);
        }
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
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

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // ── معالجة 401 ────────────────────────────────────────────────────────
    if (res.status === 401 && retry) {
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // أعد المحاولة بالـ token الجديد
        return apiFetch<T>(endpoint, options, false);
      }

      // فشل الـ refresh — امسح كل شيء وأعد للـ login
      clearTokens();

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

    // ── 204 No Content ─────────────────────────────────────────────────────
    if (res.status === 204) {
      return { success: true, data: {} as T };
    }

    const data = await res.json();

    if (res.ok) {
      if (data.success !== undefined) return data as ApiResponse<T>;
      return { success: true, data: data as T };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }
    return {
      success: false,
      error: { code: res.status, message: data.message || "حدث خطأ غير متوقع." },
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

  // ─── Auth-specific methods ──────────────────────────────────────────────

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
