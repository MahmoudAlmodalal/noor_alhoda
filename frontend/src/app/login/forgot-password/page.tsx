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
            <div className="text-center mb-8">
                <h1 className="text-2xl font-black text-slate-800 mb-2">استعادة كلمة المرور</h1>
                <p className="text-sm text-slate-500 font-medium">الخطوة 1 من 3: أدخل رقم الجوال المسجل</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
                    <Input
                        type="tel"
                        placeholder="05X XXX XXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="text-start"
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                    {phoneError && <p className="text-sm text-red-500 mt-1">{phoneError}</p>}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-bold shadow-md shadow-primary/10 mt-6"
                >
                    {isSubmitting ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
                </Button>
            </form>
        </div>
    );
}
