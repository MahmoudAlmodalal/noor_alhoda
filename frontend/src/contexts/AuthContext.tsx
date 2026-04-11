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

  // عند بدء التطبيق: تحقق من صلاحية الـ token الموجود
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    // ❌ تم حذف: كانت هذه المنطقة تمسح الـ tokens فور الوصول لـ /login
    // مما يمنع الـ auto-refresh ويسبب "انتهت الجلسة" بدون سبب حقيقي.
    // الآن: نتحقق من الـ token عبر api.me() بغض النظر عن الصفحة الحالية.

    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    api
      .me()
      .then((res) => {
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
        } else {
          // امسح الـ tokens فقط عند 401/403 المؤكدة
          // (apiFetch يتولى تلقائياً الـ refresh قبل الوصول هنا)
          if (res.error.code === 401 || res.error.code === 403) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
          }
          // 0 = خطأ شبكة، 500 = خطأ سيرفر — لا نمسح الـ tokens
        }
      })
      .catch(() => {
        // خطأ في الشبكة — لا نمسح الـ tokens حتى يتمكن المستخدم من إعادة المحاولة
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(
    async (phone_number: string, password: string): Promise<string | null> => {
      const res = await api.login({ phone_number, password });

      if (res.success) {
        // بعد تسجيل الدخول نجلب الـ profile الكامل للحصول على IDs
        const meRes = await api.me();
        if (meRes.success) {
          const data = meRes.data;
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
        } else {
          // تعذّر جلب الـ profile لكن تسجيل الدخول نجح — استخدم البيانات الأساسية
          setUser(res.data.user);
        }
        return null;
      }

      return res.error.message;
    },
    []
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
