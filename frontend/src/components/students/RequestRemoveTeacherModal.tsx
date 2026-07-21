"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface RequestRemoveTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  studentName: string;
}

export function RequestRemoveTeacherModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
}: RequestRemoveTeacherModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} className="max-w-md">
      <form onSubmit={handleSubmit}>
        <h2 className="text-lg font-bold text-text-body mb-2">
          طلب إزالة من الحلقة
        </h2>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          أنت على وشك طلب إزالة الطالب <span className="font-bold text-text-body">{studentName}</span> من حلقتك. لن تتم الإزالة إلا بعد موافقة الإدارة. هل أنت متأكد؟
        </p>
        
        <div className="mb-6">
          <label htmlFor="reason" className="block text-sm font-medium text-text-body mb-2">
            سبب الطلب (اختياري)
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-border-card bg-surface-card px-4 py-3 text-sm text-text-body placeholder-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
            placeholder="اكتب سبب طلب الإزالة هنا..."
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-11 rounded-xl font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-xl font-bold gap-2 bg-red-500 hover:bg-red-600 text-white"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            تأكيد الطلب
          </Button>
        </div>
      </form>
    </Modal>
  );
}
