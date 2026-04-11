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
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-slate-800 mb-2">تسجيل الدخول</h1>
        <p className="text-sm text-slate-500 font-medium">أهلاً بك مجدداً في نظام المركز</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
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
          <label className="block text-sm font-bold text-slate-800">كلمة المرور</label>
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

        <div className="flex items-center justify-start pt-1">
          <Link
            href="/login/forgot-password"
            className="text-sm font-bold text-secondary hover:text-secondary/80 hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base font-bold shadow-md shadow-primary/10 mt-6"
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
