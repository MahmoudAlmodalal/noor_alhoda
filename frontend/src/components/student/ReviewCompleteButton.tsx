"use client";

import { Check, Loader2 } from "lucide-react";
import { useMutation } from "@/hooks/useMutation";

interface Props {
  studentId: string;
  surahName: string;
  onComplete?: () => void;
}

export function ReviewCompleteButton({ studentId, surahName, onComplete }: Props) {
  const { mutate, isSubmitting } = useMutation("review_record", "create");

  async function handleClick() {
    const result = await mutate(
      {
        student_id: studentId,
        surah_name: surahName,
        reviewed_date: new Date().toISOString().slice(0, 10),
        quality: "acceptable",
      },
      { successMessage: "تمت المراجعة بنجاح" }
    );
    if (result) onComplete?.();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isSubmitting}
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#dcfce7] px-3 py-1.5 text-[13px] font-bold text-[#008236] transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      <span>تمت المراجعة</span>
    </button>
  );
}
