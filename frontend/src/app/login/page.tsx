"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Loader2, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches
  );
  const [showGuide, setShowGuide] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Detect available update
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        // Already waiting (update downloaded before page load)
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
        }
        // New update found while page is open
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
            }
          });
        });
      });
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  // Update available
  if (waitingWorker) {
    return (
      <button
        type="button"
        onClick={() => {
          waitingWorker.postMessage({ type: "SKIP_WAITING" });
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
          });
        }}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-blue-300 text-blue-600 text-sm font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        يوجد تحديث — اضغط للتحديث الآن
      </button>
    );
  }

  // Browser supports install prompt
  if (prompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
        }}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 text-slate-600 text-sm font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        تثبيت التطبيق على جهازك
      </button>
    );
  }

  // Fallback: manual install guide
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setShowGuide((v) => !v)}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 text-slate-600 text-sm font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors"
      >
        <Download className="w-4 h-4" />
        تثبيت التطبيق على جهازك
      </button>
      {showGuide && (
        <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 leading-6 text-right space-y-1">
          <p className="font-bold text-slate-700">كيفية التثبيت:</p>
          <p>
            <span className="font-bold">Android Chrome:</span> القائمة (⋮) ← &quot;تثبيت التطبيق&quot;
          </p>
          <p>
            <span className="font-bold">iOS Safari:</span> زر المشاركة (
            <span className="font-bold">⎙</span>) ← &quot;إضافة إلى الشاشة الرئيسية&quot;
          </p>
        </div>
      )}
    </div>
  );
}

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
      setError("يرجى إدخال رقم الهوية وكلمة المرور.");
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
            رقم الهوية
          </label>
          <Input
            type="text"
            placeholder="أدخل رقم الهوية"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-label="رقم الهوية"
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

        <InstallButton />
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
