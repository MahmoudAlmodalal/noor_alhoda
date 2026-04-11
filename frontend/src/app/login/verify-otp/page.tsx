"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OTPInput } from "@/components/ui/OTPInput";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/hooks/useMutation";
import type { OtpSendRequest } from "@/types/api";

const OTP_LENGTH = 6;

export default function VerifyOTPPage() {
    const router = useRouter();
    const [phone, setPhone] = useState<string>("");
    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { mutate: resend, isSubmitting: isResending } = useMutation<unknown>(
        "post",
        "/api/auth/otp/send/"
    );

    useEffect(() => {
        const stored = sessionStorage.getItem("pw_reset");
        if (!stored) {
            router.replace("/login/forgot-password");
            return;
        }
        try {
            const parsed = JSON.parse(stored);
            if (!parsed.phone_number) {
                router.replace("/login/forgot-password");
                return;
            }
            setPhone(parsed.phone_number);
        } catch {
            router.replace("/login/forgot-password");
        }
    }, [router]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (otp.length < OTP_LENGTH) {
            setError("الرمز غير مكتمل");
            return;
        }

        sessionStorage.setItem(
            "pw_reset",
            JSON.stringify({ phone_number: phone, code: otp })
        );
        router.push("/login/reset-password");
    };

    const handleResend = async () => {
        if (!phone) return;
        const payload: OtpSendRequest = { phone_number: phone };
        await resend(payload, { successMessage: "تم إرسال رمز جديد" });
    };

    if (!phone) {
        return <div className="text-center py-10">جاري التحميل...</div>;
    }

    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">إدخال رمز التحقق</h1>
                <p className="text-sm text-[#6a7282] leading-5">
                    الخطوة 2 من 3: تم إرسال رمز {OTP_LENGTH} أرقام إلى
                    <br />
                    <span className="font-bold text-[#364153]" dir="ltr">{phone}</span>
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex justify-center px-2">
                    <OTPInput
                        length={OTP_LENGTH}
                        value={otp}
                        onChange={setOtp}
                        error={error || undefined}
                    />
                </div>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={isResending}
                        className="text-sm font-bold text-secondary hover:underline disabled:opacity-50"
                    >
                        {isResending ? "جارٍ الإرسال..." : "إعادة إرسال الرمز"}
                    </button>
                </div>

                <Button
                    type="submit"
                    size="lg"
                    disabled={otp.length !== OTP_LENGTH}
                    className="w-full h-14 text-lg font-bold"
                >
                    تحقق من الرمز
                </Button>
            </form>
        </div>
    );
}
