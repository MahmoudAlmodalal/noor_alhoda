"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";

interface Props {
    studentId: string;
    surahName: string;
    onComplete?: () => void;
}

export function ReviewCompleteButton({ studentId, surahName, onComplete }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    async function handleClick() {
        setIsSubmitting(true);
        const res = await api.post(`/api/students/${studentId}/reviews/complete/`, {
            surah_name: surahName,
            quality: "acceptable",
        });
        setIsSubmitting(false);

        if (res.success) {
            showToast("تمت المراجعة بنجاح", "success");
            onComplete?.();
        } else {
            showToast(res.error.message, "error");
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#dcfce7] px-3 py-1.5 text-[13px] font-bold text-[#008236] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
            {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Check className="h-4 w-4" />
            )}
            <span>تمت المراجعة</span>
        </button>
    );
}
