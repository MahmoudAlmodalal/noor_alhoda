"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/hooks/useMutation";
import type { OtpSendRequest } from "@/types/api";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [nationalId, setNationalId] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const { mutate, isSubmitting, error, fieldErrors } = useMutation<unknown>(
        "post",
        "/api/auth/otp/send/"
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (!nationalId) {
            setValidationError("رقم الهوية مطلوب");
            return;
        }

        const payload: OtpSendRequest = { national_id: nationalId };
        const result = await mutate(payload, {
            successMessage: "تم إرسال رمز التحقق",
        });
        if (!result && !fieldErrors) return;
        if (result !== null) {
            sessionStorage.setItem(
                "pw_reset",
                JSON.stringify({ national_id: nationalId })
            );
            router.push("/login/verify-otp");
        }
    };

    const nationalIdError =
        validationError ||
        (fieldErrors?.national_id
            ? Array.isArray(fieldErrors.national_id)
                ? fieldErrors.national_id[0]
                : fieldErrors.national_id
            : null) ||
        error;

    return (
        <div>
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#1e2939] leading-8 mb-1">استعادة كلمة المرور</h1>
                <p className="text-sm text-[#6a7282] leading-5">الخطوة 1 من 3: أدخل رقم الهوية المسجل</p>
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
                    {nationalIdError && <p className="text-sm text-red-500 mt-1">{nationalIdError}</p>}
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
