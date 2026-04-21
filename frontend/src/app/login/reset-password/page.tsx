"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import type { OtpVerifyRequest } from "@/types/api";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [nationalId, setNationalId] = useState<string>("");
    const [code, setCode] = useState<string>("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResolved, setIsResolved] = useState(false);

    useEffect(() => {
        let timeoutId: number | undefined;
        const stored = sessionStorage.getItem("pw_reset");
        if (!stored) {
            router.replace("/login/forgot-password");
            timeoutId = window.setTimeout(() => setIsResolved(true), 0);
            return;
        }
        try {
            const parsed = JSON.parse(stored) as {
                national_id?: string;
                code?: string;
            };
            if (!parsed.national_id || !parsed.code) {
                router.replace("/login/forgot-password");
                timeoutId = window.setTimeout(() => setIsResolved(true), 0);
                return;
            }
            timeoutId = window.setTimeout(() => {
                setNationalId(parsed.national_id ?? "");
                setCode(parsed.code ?? "");
                setIsResolved(true);
            }, 0);
        } catch {
            router.replace("/login/forgot-password");
            timeoutId = window.setTimeout(() => setIsResolved(true), 0);
        }

        return () => {
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password || !confirmPassword) {
            setError("الرجاء تعبئة جميع الحقول");
            return;
        }
        if (password !== confirmPassword) {
            setError("كلمتا المرور غير متطابقتين");
            return;
        }
        if (password.length < 8) {
            setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
            return;
        }

        setIsSubmitting(true);
        const payload: OtpVerifyRequest = {
            national_id: nationalId,
            code,
            new_password: password,
        };
        const res = await api.post("/api/auth/otp/verify/", payload);
        setIsSubmitting(false);

        if (!res.success) {
            setError(res.error.message);
            return;
        }
        sessionStorage.removeItem("pw_reset");
        router.push("/login?reset=success");
    };

    if (!isResolved || !nationalId || !code) {
        return <div className="text-center py-10">جاري التحميل...</div>;
    }

    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">كلمة مرور جديدة</h1>
                <p className="text-sm text-[#6a7282] leading-5">الخطوة 3 من 3: قم بتعيين كلمة مرور قوية</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#364153]">كلمة المرور الجديدة</label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-label="كلمة المرور الجديدة"
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#364153]">تأكيد كلمة المرور</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        aria-label="تأكيد كلمة المرور"
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>

                <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full h-14 text-lg font-bold gap-2"
                >
                    {isSubmitting ? "جارٍ الحفظ..." : "تأكيد وحفظ"}
                    <CheckCircle2 className="w-5 h-5" />
                </Button>
            </form>
        </div>
    );
}
