"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useMutation } from "@/hooks/useMutation";
import { useToast } from "@/contexts/ToastContext";

interface Props {
  studentId: string;
  initialDays: number;
  onSaved?: (days: number) => void;
}

export function ReviewIntervalInput({ studentId, initialDays, onSaved }: Props) {
  const [value, setValue] = useState<number>(initialDays);
  const { showToast } = useToast();
  const { mutate, isSubmitting } = useMutation("student", "update");

  useEffect(() => {
    setValue(initialDays);
  }, [initialDays]);

  const dirty = value !== initialDays;

  async function save() {
    if (!dirty) return;
    if (value < 1 || value > 90) {
      showToast("الفترة يجب أن تكون بين 1 و 90 يوماً", "error");
      return;
    }
    const result = await mutate(
      { id: studentId, review_interval_days: value },
      { silent: true }
    );
    if (result) {
      showToast("تم الحفظ", "success");
      onSaved?.(value);
    }
  }

  return (
    <div className="flex items-center justify-center gap-1" dir="ltr">
      <input
        type="number"
        min={1}
        max={90}
        value={value}
        onChange={(e) => setValue(Math.max(1, parseInt(e.target.value || "1", 10)))}
        className="h-8 w-14 rounded-[8px] border border-border-subtle bg-white text-center text-xs font-bold text-text-body focus:outline-none focus:ring-1 focus:ring-primary/40"
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || isSubmitting}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-primary/30 text-primary transition-opacity disabled:opacity-30"
        title="حفظ"
      >
        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
