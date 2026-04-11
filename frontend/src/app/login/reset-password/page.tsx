"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";
import { useMutation } from "@/hooks/useMutation";
import type { OtpVerifyRequest } from "@/types/api";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [phone, setPhone] = useState<string>("");
    const [code, setCode] = useState<string>("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const { mutate, isSubmitting, error, fieldErrors } = useMutation<unknown>(
        "post",
        "/api/auth/otp/verify/"
    );

    useEffect(() => {
        const stored = sessionStorage.getItem("pw_reset");
        if (!stored) {
            router.replace("/login/forgot-password");
            return;
        }
        try {
            const parsed = JSON.parse(stored);
            if (!parsed.phone_number || !parsed.code) {
                router.replace("/login/forgot-password");
                return;
            }
            setPhone(parsed.phone_number);
            setCode(parsed.code);
        } catch {
            router.replace("/login/forgot-password");
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (!password || !confirmPassword) {
            setValidationError("الرجاء تعبئة جميع الحقول");
            return;
        }
        if (password !== confirmPassword) {
            setValidationError("كلمتا المرور غير متطابقتين");
            return;
        }
        if (password.length < 8) {
            setValidationError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
            return;
        }

        const payload: OtpVerifyRequest = {
            phone_number: phone,
            code,
            new_password: password,
        };
        const result = await mutate(payload, {
            successMessage: "تم تغيير كلمة المرور بنجاح",
        });
        if (result !== null) {
            sessionStorage.removeItem("pw_reset");
            router.push("/login?reset=success");
        }
    };

    const codeError =
        fieldErrors?.code
            ? Array.isArray(fieldErrors.code)
                ? fieldErrors.code[0]
                : fieldErrors.code
            : null;
    const passwordError =
        validationError ||
        (fieldErrors?.new_password
            ? Array.isArray(fieldErrors.new_password)
                ? fieldErrors.new_password[0]
                : fieldErrors.new_password
            : null);

    if (!phone || !code) {
        return <div className="text-center py-10">جاري التحميل...</div>;
    }

    return (
        <div>
            <div className="text-center mb-8">
                <h1 className="text-2xl font-black text-slate-800 mb-2">كلمة مرور جديدة</h1>
                <p className="text-sm text-slate-500 font-medium">الخطوة 3 من 3: قم بتعيين كلمة مرور قوية</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800">كلمة المرور الجديدة</label>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800">تأكيد كلمة المرور</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        dir="ltr"
                        disabled={isSubmitting}
                    />
                    {passwordError && <p className="text-sm text-red-500 mt-1">{passwordError}</p>}
                    {codeError && <p className="text-sm text-red-500 mt-1">{codeError}</p>}
                    {!passwordError && !codeError && error && (
                        <p className="text-sm text-red-500 mt-1">{error}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base font-bold shadow-md shadow-primary/10 mt-6 gap-2"
                >
                    {isSubmitting ? "جارٍ الحفظ..." : "تأكيد وحفظ"}
                    <CheckCircle2 className="w-5 h-5 bg-transparent rounded-full" />
                </Button>
            </form>
        </div>
    );
}
