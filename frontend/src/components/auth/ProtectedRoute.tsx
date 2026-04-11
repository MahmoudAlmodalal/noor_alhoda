"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // تحقق إذا في توكنات محفوظة — إذا في، ربما السيرفر كان نايم وسيصحى
  const hasTokens =
    typeof window !== "undefined" &&
    !!localStorage.getItem("access_token");

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasTokens) {
      // لا يوجد توكنات أصلاً → المستخدم غير مسجّل دخول حقاً
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, hasTokens, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // إذا مو authenticated لكن في توكنات → السيرفر ربما كان نايم
  // نعرض شاشة انتظار بدل ما نطرد المستخدم
  if (!isAuthenticated && hasTokens) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">
            جاري الاتصال بالخادم...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
