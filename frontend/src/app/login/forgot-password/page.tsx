"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/hooks/useMutation";
import type { OtpSendRequest } from "@/types/api";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const { mutate, isSubmitting, error, fieldErrors } = useMutation<unknown>(
        "post",
        "/api/auth/otp/send/"
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (!phone) {
            setValidationError("رقم الجوال مطلوب");
            return;
        }

        const payload: OtpSendRequest = { phone_number: phone };
        const result = await mutate(payload, {
            successMessage: "تم إرسال رمز التحقق",
        });
        if (!result && !fieldErrors) return;
        if (result !== null) {
            sessionStorage.setItem(
                "pw_reset",
                JSON.stringify({ phone_number: phone })
            );
            router.push("/login/verify-otp");
        }
    };

    const phoneError =
        validationError ||
        (fieldErrors?.phone_number
            ? Array.isArray(fieldErrors.phone_number)
                ? fieldErrors.phone_number[0]
                : fieldErrors.phone_number
            : null) ||
        error;

    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">استعادة كلمة المرور</h1>
                <p className="text-sm text-[#6a7282] leading-5">الخطوة 1 من 3: أدخل رقم الجوال المسجل</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-[#364153]">رقم الجوال</label>
                    <Input
                        type="tel"
                        placeholder="05X XXX XXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        aria-label="رقم الجوال"
                        className="text-start"
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                    {phoneError && <p className="text-sm text-red-500 mt-1">{phoneError}</p>}
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
