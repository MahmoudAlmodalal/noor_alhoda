"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { OtpSendRequest } from "@/types/api";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [nationalId, setNationalId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!nationalId) {
            setError("رقم الهوية مطلوب");
            return;
        }

        setIsSubmitting(true);
        const payload: OtpSendRequest = { national_id: nationalId };
        const res = await api.post("/api/auth/otp/send/", payload);
        setIsSubmitting(false);

        if (!res.success) {
            setError(res.error.message);
            return;
        }
        sessionStorage.setItem(
            "pw_reset",
            JSON.stringify({ national_id: nationalId })
        );
        router.push("/login/verify-otp");
    };

    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">استعادة كلمة المرور</h1>
                <p className="text-sm text-text-muted leading-5">الخطوة 1 من 3: أدخل رقم الهوية المسجل</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#364153]">رقم الهوية</label>
                    <Input
                        type="text"
                        placeholder="1XXXXXXXXX"
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        aria-label="رقم الهوية"
                        className="text-start"
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>

                <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full h-14 text-lg font-bold"
                >
                    {isSubmitting ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
                </Button>
            </form>
        </div>
    );
}
