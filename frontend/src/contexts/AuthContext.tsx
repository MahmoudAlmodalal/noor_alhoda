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
  login: (phone_number: string, password: string) => Promise<string | null>;
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
    if (res.error.code === 401 || res.error.code === 403) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    return false;
  }, []);

  // عند بدء التطبيق: تحقق من صلاحية الـ token الموجود
  // مع retry تلقائي إذا كان السيرفر نايم (Render free tier cold start)
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    // حاول الاتصال بالسيرفر — مع retry تلقائي إذا كان نايم
    const MAX_RETRIES = 4;
    const RETRY_DELAY_MS = 3000;

    (async () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const success = await fetchMe();
          if (success) break; // نجح → انتهينا

          // إذا مسحت التوكنات (401/403) → لا فائدة من المحاولة مجدداً
          if (!localStorage.getItem("access_token")) break;

          // فشل مؤقت → انتظر قبل المحاولة التالية
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        } catch {
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(
    async (phone_number: string, password: string): Promise<string | null> => {
      const res = await api.login({ phone_number, password });

      if (res.success) {
        // بعد تسجيل الدخول نجلب الـ profile الكامل للحصول على IDs
        const meSuccess = await fetchMe();
        if (!meSuccess) {
          // تعذّر جلب الـ profile لكن تسجيل الدخول نجح — استخدم البيانات الأساسية
          setUser(res.data.user);
        }
        return null;
      }

      return res.error.message;
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
