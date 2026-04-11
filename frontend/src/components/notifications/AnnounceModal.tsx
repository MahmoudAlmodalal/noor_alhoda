"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMutation } from "@/hooks/useMutation";
import { useApi } from "@/hooks/useApi";
import type { AnnounceRequest, Ring } from "@/types/api";

export function AnnounceModal({
  isOpen,
  onClose,
  onSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [audience, setAudience] = useState<AnnounceRequest["audience"]>("all");
  const [ringId, setRingId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data: rings } = useApi<Ring[]>(isOpen && audience === "ring" ? "/api/students/rings/" : null);
  const { mutate, isSubmitting, fieldErrors, error } = useMutation(
    "post",
    "/api/notifications/announce/"
  );

  const handleSubmit = async () => {
    const payload: AnnounceRequest = {
      audience,
      title,
      body,
      ...(audience === "ring" && ringId ? { ring_id: ringId } : {}),
    };
    const result = await mutate(payload, { successMessage: "تم إرسال الإعلان" });
    if (result !== null) {
      setTitle("");
      setBody("");
      setAudience("all");
      setRingId("");
      onSent?.();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <h2 className="text-xl font-bold text-primary mb-6">إرسال إعلان</h2>

      <div className="space-y-4 mb-8">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الجمهور</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnounceRequest["audience"])}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">الجميع</option>
            <option value="teachers">المحفظون</option>
            <option value="parents">أولياء الأمور</option>
            <option value="students">الطلاب</option>
            <option value="ring">حلقة محددة</option>
          </select>
        </div>

        {audience === "ring" && (
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-800">الحلقة</label>
            <select
              value={ringId}
              onChange={(e) => setRingId(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— اختر الحلقة —</option>
              {(rings ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">العنوان</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 rounded-xl border-slate-200"
          />
          {fieldErrors?.title && (
            <p className="text-xs text-red-500">{fieldErrors.title}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-800">الرسالة</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          {fieldErrors?.body && (
            <p className="text-xs text-red-500">{fieldErrors.body}</p>
          )}
        </div>

        {error && !fieldErrors && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onClose}
          className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold"
        >
          إلغاء
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title || !body || (audience === "ring" && !ringId)}
          className="flex-[1.5] h-12 rounded-xl font-bold gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          إرسال
        </Button>
      </div>
    </Modal>
  );
}
