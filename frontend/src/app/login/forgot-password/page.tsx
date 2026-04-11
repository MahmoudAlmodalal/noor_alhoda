"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!phone) {
            setError("رقم الجوال مطلوب");
            return;
        } else if (!/^05\d{8}$/.test(phone)) {
            setError("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام");
            return;
        }

        // Pass the phone number to the next step via query param or store
        router.push(`/login/verify-otp?phone=${phone}`);
    };

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
                    />
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold shadow-md shadow-primary/10 mt-6"
                >
                    إرسال رمز التحقق
                </Button>
            </form>
        </div>
    );
}
