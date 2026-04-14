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
import type { UserProfile } from "@/types/api";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (national_id: string, password: string) => Promise<{ error: string | null; role: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // دالة مشتركة لجلب بيانات المستخدم من الـ API
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

  // عند بدء التطبيق: تحقق من صلاحية الـ token الموجود
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      if (typeof window === "undefined") {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      const token = localStorage.getItem("access_token");
      if (!token) {
        if (isMounted) {
          setIsLoading(false);
        }
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
          // network error
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (!authed && localStorage.getItem("access_token")) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchMe]);

  const login = useCallback(
    async (national_id: string, password: string): Promise<{ error: string | null; role: string | null }> => {
      const res = await api.login({ national_id, password });

      if (res.success) {
        const meSuccess = await fetchMe();
        const role = meSuccess
          ? res.data.user.role
          : res.data.user.role;
        if (!meSuccess) {
          setUser(res.data.user);
        }
        return { error: null, role };
      }

      return { error: res.error.message, role: null };
    },
    [fetchMe]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
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
