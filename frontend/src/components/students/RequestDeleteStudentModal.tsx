"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface RequestDeleteStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  studentName: string;
}

export function RequestDeleteStudentModal({
  isOpen,
  onClose,
  onSubmit,
  studentName,
}: RequestDeleteStudentModalProps) {
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
          طلب حذف الطالب
        </h2>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          أنت على وشك طلب الحذف النهائي للطالب <span className="font-bold text-text-body">{studentName}</span> من النظام بالكامل. لن يتم الحذف إلا بعد موافقة الإدارة. هل أنت متأكد؟
        </p>
        
        <div className="mb-6">
          <label htmlFor="delete-reason" className="block text-sm font-medium text-text-body mb-2">
            سبب طلب الحذف (مطلوب)
          </label>
          <textarea
            id="delete-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            required
            className="w-full rounded-xl border border-border-card bg-surface-card px-4 py-3 text-sm text-text-body placeholder-text-muted focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50 resize-none"
            placeholder="اكتب سبب طلب الحذف هنا..."
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
            disabled={isSubmitting || !reason.trim()}
            className="flex-1 h-11 rounded-xl font-bold gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            تأكيد طلب الحذف
          </Button>
        </div>
      </form>
    </Modal>
  );
}
