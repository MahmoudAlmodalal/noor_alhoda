"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim() || !password.trim()) {
      setError("يرجى إدخال رقم الجوال وكلمة المرور.");
      return;
    }

    setIsSubmitting(true);
    const errorMsg = await login(phone, password);
    setIsSubmitting(false);

    if (errorMsg) {
      setError(errorMsg);
    } else {
      router.push("/");
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">تسجيل الدخول</h1>
        <p className="text-sm text-[#6a7282] leading-5">أهلاً بك مجدداً في نظام المركز</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-[#364153]">رقم الجوال</label>
          <Input
            type="tel"
            placeholder="05X XXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="text-start"
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-[#364153]">كلمة المرور</label>
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            endIcon={
              showPassword ? (
                <EyeOff onClick={() => setShowPassword(false)} className="w-5 h-5 cursor-pointer hover:text-slate-600" />
              ) : (
                <Eye onClick={() => setShowPassword(true)} className="w-5 h-5 cursor-pointer hover:text-slate-600" />
              )
            }
            dir="ltr"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 font-medium text-center">{error}</p>
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
