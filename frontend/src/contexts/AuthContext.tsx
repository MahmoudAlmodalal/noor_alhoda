"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  clearSessionKey,
  hasCachedAuth,
  initializeOrUnlockSession,
  unlockOffline,
} from "@/lib/db/auth";
import { wipeDb } from "@/lib/db/schema";
import { startSyncRunner, stopSyncRunner } from "@/lib/sync/runner";
import type { UserProfile } from "@/types/api";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * True when the user is authenticated AND the encrypted local DB has
   * been unlocked in this tab. Repos throw when this is false.
   */
  dbUnlocked: boolean;
  isOfflineSession: boolean;
  login: (
    national_id: string,
    password: string
  ) => Promise<{ error: string | null; role: string | null; offline: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbUnlocked, setDbUnlocked] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  // Fetch server profile and hydrate user state.
  const fetchMe = useCallback(async (): Promise<boolean> => {
    const res = await api.me();
    if (res.success) {
      const data = res.data;
      setUser({
        id: data.id as string,
        national_id: data.national_id as string,
        phone_number: data.phone_number as string,
        role: data.role as UserProfile["role"],
        full_name:
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          (data.full_name as string),
        student_profile: data.student_profile as UserProfile["student_profile"],
        teacher_profile: data.teacher_profile as UserProfile["teacher_profile"],
        parent_profile: data.parent_profile as UserProfile["parent_profile"],
      });
      return true;
    }
    if (res.error?.code === 401 || res.error?.code === 403) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    return false;
  }, []);

  // On boot: if tokens exist and network is available, refresh user from
  // /me. DB remains locked until the user logs in (enters password).
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      if (typeof window === "undefined") {
        if (isMounted) setIsLoading(false);
        return;
      }

      const token = localStorage.getItem("access_token");
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      const MAX_RETRIES = 2;
      const RETRY_DELAY_MS = 1500;
      let authed = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (await fetchMe()) {
            authed = true;
            break;
          }
          if (!localStorage.getItem("access_token")) break;
        } catch {
          // network error — fall through to retry
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (!authed && localStorage.getItem("access_token")) {
        // Can't reach server. If the user has a cached auth row and wants
        // to work offline, they must re-login (password unlocks DB).
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }

      if (isMounted) setIsLoading(false);
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchMe]);

  const login = useCallback(
    async (
      national_id: string,
      password: string
    ): Promise<{ error: string | null; role: string | null; offline: boolean }> => {
      // 1. Try online login. Populates tokens on success.
      const res = await api.login({ national_id, password });

      if (res.success) {
        const u = res.data.user;
        await initializeOrUnlockSession({
          password,
          userId: u.id,
          userNationalId: u.national_id,
          userRole: u.role,
        });

        const meSuccess = await fetchMe();
        if (!meSuccess) setUser(u);

        setDbUnlocked(true);
        setIsOfflineSession(false);
        startSyncRunner();
        return { error: null, role: u.role, offline: false };
      }

      // 2. Online login failed. If it's a network error and we have a
      //    cached auth row for this national_id, try offline login.
      const isNetworkError = res.error.code === 0;
      if (isNetworkError && (await hasCachedAuth())) {
        try {
          const row = await unlockOffline({ password, userNationalId: national_id });
          // Offline login succeeded — hydrate minimal user state from cache.
          setUser({
            id: row.user_id,
            national_id: row.user_national_id,
            phone_number: "",
            role: row.user_role as UserProfile["role"],
            full_name: "",
          });
          setDbUnlocked(true);
          setIsOfflineSession(true);
          // Start the sync runner so that whenever connectivity returns
          // we'll pull the latest data without needing a reload.
          startSyncRunner();
          return { error: null, role: row.user_role, offline: true };
        } catch (err) {
          const code = err instanceof Error ? err.message : String(err);
          const message =
            code === "OFFLINE_LOGIN_INVALID_PASSWORD"
              ? "كلمة المرور غير صحيحة."
              : code === "OFFLINE_LOGIN_USER_MISMATCH"
                ? "رقم الهوية لا يطابق الحساب المسجّل على هذا الجهاز."
                : "تعذّر تسجيل الدخول دون اتصال. يجب تسجيل الدخول أونلاين أولاً.";
          return { error: message, role: null, offline: false };
        }
      }

      if (isNetworkError) {
        return {
          error: "يجب الاتصال بالإنترنت لتسجيل الدخول لأول مرة على هذا الجهاز.",
          role: null,
          offline: false,
        };
      }

      return { error: res.error.message, role: null, offline: false };
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    stopSyncRunner();
    try {
      await api.logout();
    } catch {
      // Offline logout — just proceed to clear local state.
    }
    clearSessionKey();
    setDbUnlocked(false);
    setIsOfflineSession(false);
    setUser(null);
    // Wipe local encrypted DB so the next user can't see this user's cached data.
    try {
      await wipeDb();
    } catch {
      // non-fatal
    }
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        dbUnlocked,
        isOfflineSession,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
