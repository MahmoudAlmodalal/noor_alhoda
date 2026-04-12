"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// ── مكوّن داخلي يقرأ searchParams (يجب لفّه بـ Suspense) ──────────────────
function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // إذا جاء المستخدم من redirect بسبب انتهاء الجلسة، أظهر الرسالة فوراً
  const [error, setError] = useState<string | null>(
    searchParams.get("reason") === "session_expired"
      ? "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً."
      : null
  );

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !password.trim()) {
      setError("يرجى إدخال رقم الجوال وكلمة المرور.");
      return;
    }

    setIsSubmitting(true);
    const { error: errorMsg, role } = await login(phone, password);
    setIsSubmitting(false);

    if (errorMsg) {
      setError(errorMsg);
    } else {
      if (role === "student") {
        router.push("/student");
      } else {
        router.push("/");
      }
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">
          تسجيل الدخول
        </h1>
        <p className="text-sm text-[#6a7282] leading-5">
          أهلاً بك مجدداً في نظام المركز
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-[#364153]">
            رقم الجوال
          </label>
          <Input
            type="tel"
            placeholder="05X XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="رقم الجوال"
            className="text-start"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-[#364153]">
            كلمة المرور
          </label>
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="كلمة المرور"
            endIcon={
              showPassword ? (
                <EyeOff
                  onClick={() => setShowPassword(false)}
                  className="w-5 h-5 cursor-pointer hover:text-slate-600"
                />
              ) : (
                <Eye
                  onClick={() => setShowPassword(true)}
                  className="w-5 h-5 cursor-pointer hover:text-slate-600"
                />
              )
            }
            dir="ltr"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 font-medium text-center">
            {error}
          </p>
        )}

        <div className="flex items-center justify-center">
          <Link
            href="/login/forgot-password"
            className="text-sm font-bold text-secondary hover:text-secondary/80 hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full h-14 text-lg font-bold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin me-2" />
              جاري تسجيل الدخول...
            </>
          ) : (
            "تسجيل الدخول"
          )}
        </Button>
      </form>
    </div>
  );
}

// ── الصفحة الرئيسية ملفوفة بـ Suspense لأن useSearchParams يتطلب ذلك ──────
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
