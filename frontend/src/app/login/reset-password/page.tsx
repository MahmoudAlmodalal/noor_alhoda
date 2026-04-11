"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
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

        // Process saving the new password...
        // Simulating success and redirect:
        router.push("/login?reset=success");
    };

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
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-800">تأكيد كلمة المرور</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        dir="ltr"
                    />
                    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 text-base font-bold shadow-md shadow-primary/10 mt-6 gap-2"
                >
                    تأكيد وحفظ
                    <CheckCircle2 className="w-5 h-5 bg-transparent rounded-full" />
                </Button>
            </form>
        </div>
    );
}
