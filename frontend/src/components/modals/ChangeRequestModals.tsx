"use client";

import { useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import { useBrowsableStudents } from "@/hooks/useBrowsableStudents";
import type { ChangeRequestAction } from "@/types/api";

async function submitChangeRequest(
  action: ChangeRequestAction,
  studentId: string
): Promise<{ ok: boolean; message: string }> {
  const res = await api.post("/api/students/teacher-requests/", {
    action,
    student_id: studentId,
  });
  if (!res.success) {
    return { ok: false, message: res.error.message };
  }
  return { ok: true, message: "" };
}

/**
 * Request removing a student from the teacher's own roster (action=unassign).
 * Direct online call, same pattern as AnnounceModal — not part of the Dexie
 * outbox, since the student stays on the teacher's roster until an admin
 * approves the request.
 */
export function RequestRemoveTeacherModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();

  const handleConfirm = async () => {
    const result = await submitChangeRequest("unassign", studentId);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    showToast("تم إرسال طلب الإزالة، بانتظار موافقة الإدارة", "success");
    onSuccess?.();
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="طلب إزالة من الحلقة"
      message={`سيُرسَل طلب إزالة الطالب "${studentName}" من حلقتك إلى الإدارة للموافقة.`}
      confirmLabel="إرسال الطلب"
      destructive
    />
  );
}

/**
 * Request deleting a student entirely (action=delete). Same pattern as
 * RequestRemoveTeacherModal — the student is untouched until approval.
 */
export function RequestDeleteStudentModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();

  const handleConfirm = async () => {
    const result = await submitChangeRequest("delete", studentId);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    showToast("تم إرسال طلب الحذف، بانتظار موافقة الإدارة", "success");
    onSuccess?.();
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="طلب حذف الطالب"
      message={`سيُرسَل طلب حذف الطالب "${studentName}" نهائياً إلى الإدارة للموافقة. هذا الإجراء لا يمكن التراجع عنه بعد الموافقة.`}
      confirmLabel="إرسال الطلب"
      destructive
    />
  );
}

/**
 * Browse the full student roster (including other teachers' students, via
 * ?browse_all=true) and submit an "assign" (transfer) request for one of
 * them.
 */
export function RequestAssignStudentModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const { data: students, isLoading } = useBrowsableStudents(search);

  const handlePick = async (studentId: string) => {
    setSubmittingId(studentId);
    const result = await submitChangeRequest("assign", studentId);
    setSubmittingId(null);
    if (!result.ok) {
      showToast(result.message, "error");
      return;
    }
    showToast("تم إرسال طلب الضم، بانتظار موافقة الإدارة", "success");
    onSuccess?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <h2 className="text-xl font-bold text-primary mb-2">طلب ضم طالب</h2>
      <p className="text-sm text-text-muted mb-4">
        اختر طالباً لإرسال طلب ضمّه لحلقتك — حتى لو كان معيَّناً لمحفظ آخر حالياً.
      </p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهوية..."
          aria-label="بحث عن طالب"
          className="h-11 w-full rounded-xl border border-border-subtle bg-white pe-9 ps-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (students ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">لا توجد نتائج</p>
        ) : (
          (students ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-border-card p-3"
            >
              <Avatar name={s.full_name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-title">{s.full_name}</p>
                <p className="truncate text-[11px] text-text-muted">
                  {s.teacher_name ? `المحفظ الحالي: ${s.teacher_name}` : "بلا محفظ"}
                </p>
              </div>
              <Button
                onClick={() => handlePick(s.id)}
                disabled={submittingId === s.id}
                className="h-9 shrink-0 rounded-lg px-3 text-xs font-bold gap-1"
              >
                {submittingId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                طلب
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

/**
 * Reject a pending StudentChangeRequest with a free-text reason — built on
 * the bare Modal primitive (not ConfirmDialog) since it needs a text field.
 */
export function RejectRequestModal({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const res = await api.post(`/api/students/teacher-requests/${requestId}/reject/`, { note });
    setIsSubmitting(false);
    if (!res.success) {
      showToast(res.error.message, "error");
      return;
    }
    showToast("تم رفض الطلب", "success");
    setNote("");
    onSuccess?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <h2 className="text-lg font-bold text-text-body mb-2">رفض الطلب</h2>
      <p className="text-sm text-text-muted mb-4">يمكنك ذكر سبب الرفض (اختياري).</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="سبب الرفض..."
        aria-label="سبب الرفض"
        className="mb-6 w-full rounded-xl border border-border-subtle bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-11 rounded-xl font-bold"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl font-bold gap-2 bg-red-500 hover:bg-red-600 text-white"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          رفض الطلب
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Approve a pending StudentChangeRequest with an optional note.
 */
export function ApproveRequestModal({
  isOpen,
  onClose,
  requestId,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  onSuccess?: () => void;
}) {
  const { showToast } = useToast();
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const res = await api.post(`/api/students/teacher-requests/${requestId}/approve/`, { note });
    setIsSubmitting(false);
    if (!res.success) {
      showToast(res.error.message, "error");
      return;
    }
    showToast("تمت الموافقة على الطلب بنجاح", "success");
    setNote("");
    onSuccess?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <h2 className="text-lg font-bold text-text-body mb-2">الموافقة على الطلب</h2>
      <p className="text-sm text-text-muted mb-4">يمكنك إضافة ملاحظة للمحفظ (اختياري).</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="ملاحظة الإدارة (اختياري)..."
        aria-label="ملاحظة الإدارة"
        className="mb-6 w-full rounded-xl border border-border-subtle bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-11 rounded-xl font-bold"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          تأكيد الموافقة
        </Button>
      </div>
    </Modal>
  );
}
