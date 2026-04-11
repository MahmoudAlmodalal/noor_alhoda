import type { ApiResponse, LoginRequest, LoginResponse } from "@/types/api";

// In production, we use relative paths to avoid CORS issues and ensure same-origin requests.
// NEXT_PUBLIC_API_URL is only used if we need to point to a different domain.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// ─── Token helpers ───────────────────────────────────────────────────────────

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
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

let isRefreshing = false;

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> {
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

    // Handle 401 — try token refresh once
    if (res.status === 401 && retry && !isRefreshing) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE_URL}/api/auth/token/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            // Use the new refresh token from the response if available (token rotation)
            const newRefreshToken = refreshData.refresh || refreshToken;
            setTokens(refreshData.access, newRefreshToken);
            isRefreshing = false;
            // Retry the original request with new token
            return apiFetch<T>(endpoint, options, false);
          }
        } catch {
          // Refresh failed
        }
        isRefreshing = false;
      }

      // Refresh failed or no refresh token — force logout
      clearTokens();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return {
        success: false,
        error: { code: 401, message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً." },
      };
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return { success: true, data: {} as T };
    }

    const data = await res.json();

    // The Django API wraps responses in {success, data/error}
    if (res.ok) {
      // Some responses may already have {success: true, data: ...}
      if (data.success !== undefined) return data as ApiResponse<T>;
      return { success: true, data: data as T };
    }

    // Error response
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
      error: { code: 0, message: "لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت." },
    };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

function buildQueryString(params?: Record<string, string | undefined>): string {
  if (!params) return "";
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
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

  // ─── Auth-specific methods ───────────────────────────────────────────────

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
    return apiFetch<Record<string, unknown>>("/api/auth/me/", { method: "GET" });
  },
};
