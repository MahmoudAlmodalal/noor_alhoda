"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Send, MessageSquare, UserCheck, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sendDirectStudentMessage } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { pullSync } from "@/lib/sync/pull";

export interface StudentOption {
  id: string;
  name: string;
  circleName?: string;
}

export interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
  studentId?: string;
  studentName?: string;
  students?: StudentOption[];
}

export function DirectMessageModal({
  isOpen,
  onClose,
  onSent,
  studentId,
  studentName,
  students,
}: DirectMessageModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(studentId || "");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.circleName && s.circleName.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      if (studentId) {
        setSelectedStudentId(studentId);
      } else if (students && students.length > 0) {
        setSelectedStudentId(students[0].id);
      } else {
        setSelectedStudentId("");
      }
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen, studentId, students]);

  useEffect(() => {
    if (!studentId && filteredStudents.length > 0) {
      const exists = filteredStudents.some((s) => s.id === selectedStudentId);
      if (!exists) {
        setSelectedStudentId(filteredStudents[0].id);
      }
    }
  }, [filteredStudents, selectedStudentId, studentId]);

  const handleSubmit = async () => {
    const targetId = selectedStudentId || studentId;
    if (!targetId) {
      setError("يرجى تحديد الطالب المستهدف.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      setError("جميع الحقول مطلوبة.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await sendDirectStudentMessage({
      student_id: targetId,
      title: title.trim(),
      body: body.trim(),
    });

    setIsSubmitting(false);

    if (!res.success) {
      const errMsg = res.error?.message || "حدث خطأ أثناء إرسال الرسالة.";
      setError(errMsg);
      showToast(errMsg, "error");
      return;
    }

    showToast(res.message || "تم إرسال الرسالة المباشرة بنجاح", "success");
    setTitle("");
    setBody("");
    void pullSync();
    onSent?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6 rounded-2xl shadow-2xl dir-rtl">
      <div className="flex items-center gap-3 mb-6 border-b border-border-subtle pb-4">
        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">إرسال رسالة خاصة</h2>
          <p className="text-xs text-text-subtle">
            إرسال إشعار مباشر للطالب مع إشعار تلقائي لأولياء أموره
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {/* Recipient Display or Selection */}
        {studentId && studentName ? (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">المستلم</label>
            <div className="flex items-center gap-2.5 h-12 px-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-800 font-semibold text-sm">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>{studentName}</span>
            </div>
          </div>
        ) : students && students.length > 0 ? (
          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-body">حدد الطالب المستهدف</label>
            {students.length > 3 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-3 text-text-subtle pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الطالب أو الحلقة..."
                  aria-label="البحث عن طالب"
                  className="h-10 pr-9 text-xs rounded-xl border-border-subtle"
                />
              </div>
            )}
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              aria-label="حدد الطالب"
              className="h-12 w-full rounded-xl border border-border-subtle bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.circleName ? `(${s.circleName})` : ""}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  لا يوجد طلاب يطابقون البحث
                </option>
              )}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-body">معرف الطالب</label>
            <Input
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              placeholder="أدخل UUID الطالب"
              aria-label="معرف الطالب"
              className="h-12 rounded-xl border-border-subtle"
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">عنوان الرسالة</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: تنبيه بشأن المراجعة اليومية"
            aria-label="عنوان الرسالة"
            className="h-12 rounded-xl border-border-subtle"
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-text-body">نص الرسالة</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب تفاصيل الرسالة هنا..."
            aria-label="نص الرسالة"
            rows={4}
            className="w-full rounded-xl border border-border-subtle bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 bg-border-card/80 text-text-body hover:bg-border-subtle h-12 rounded-xl font-bold"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || !body.trim() || (!selectedStudentId && !studentId)}
          className="flex-[1.5] h-12 rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          إرسال الرسالة
        </Button>
      </div>
    </Modal>
  );
}
