"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { requiredString } from "@/lib/validators";

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const checks = [
      requiredString(currentPassword, "كلمة المرور الحالية"),
      requiredString(newPassword, "كلمة المرور الجديدة"),
      requiredString(confirmPassword, "تأكيد كلمة المرور"),
    ];
    const failed = checks.find((c) => !c.ok);
    if (failed && !failed.ok) {
      setError(failed.error);
      return;
    }
    if (newPassword.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsSubmitting(true);
    const res = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    showToast("تم تغيير كلمة المرور بنجاح.", "success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-10">
      <SectionCard padding="lg" radius="xl">
        <div className="mb-6 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-text-body">تغيير كلمة المرور</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-body">
              كلمة المرور الحالية
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              dir="ltr"
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-body">
              كلمة المرور الجديدة
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              dir="ltr"
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-body">
              تأكيد كلمة المرور الجديدة
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              dir="ltr"
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
