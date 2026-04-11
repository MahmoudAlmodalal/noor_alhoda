"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OTPInput } from "@/components/ui/OTPInput";
import { Button } from "@/components/ui/Button";
import React, { Suspense } from "react";

function VerifyOTPContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const phone = searchParams.get("phone") || "0592132403"; // fallback mock

    const [otp, setOtp] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (otp.length < 4) {
            setError("الرمز غير مكتمل");
            return;
        }

        // Go to step 3
        router.push("/login/reset-password");
    };

    return (
        <div>
            <div className="text-center mb-8">
                <h1 className="text-2xl font-black text-slate-800 mb-2">إدخال رمز التحقق</h1>
                <p className="text-sm text-slate-500 font-medium">
                    الخطوة 2 من 3: تم إرسال رمز 4 أرقام إلى
                    <br />
                    <span className="font-bold text-slate-700" dir="ltr">{phone}</span>
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center mb-6 px-4">
                    <OTPInput
                        length={4}
                        value={otp}
                        onChange={setOtp}
                        error={error || undefined}
                    />
                </div>

                <div className="text-center">
                    <span className="text-sm font-bold text-slate-500">
                        9:58
                    </span>
                </div>

                <Button
                    type="submit"
                    disabled={otp.length !== 4}
                    className="w-full h-12 text-base font-bold shadow-md shadow-primary/10"
                >
                    تحقق من الرمز
                </Button>
            </form>
        </div>
    );
}

export default function VerifyOTPPage() {
    return (
        <Suspense fallback={<div className="text-center py-10">جاري التحميل...</div>}>
            <VerifyOTPContent />
        </Suspense>
    );
}
