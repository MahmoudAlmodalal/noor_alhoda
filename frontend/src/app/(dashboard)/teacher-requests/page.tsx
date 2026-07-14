"use client";

import { useState } from "react";
import { Check, ClipboardList, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { RoleGate } from "@/components/auth/RoleGate";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import { useChangeRequests } from "@/hooks/useChangeRequests";
import { RejectRequestModal, RequestAssignStudentModal } from "@/components/modals/ChangeRequestModals";
import type { ChangeRequestStatus, StudentChangeRequest } from "@/types/api";

const ACTION_LABELS: Record<StudentChangeRequest["action"], string> = {
  assign: "ضم لحلقة",
  unassign: "إزالة من حلقة",
  create: "تسجيل طالب جديد",
  update: "تعديل بيانات",
  delete: "حذف طالب",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "الاسم رباعي",
  national_id: "رقم الهوية",
  birthdate: "تاريخ الميلاد",
  grade: "الصف الدراسي",
  phone_number: "رقم الجوال",
  mobile: "رقم الجوال",
  whatsapp: "واتساب",
  address: "العنوان",
  guardian_name: "اسم ولي الأمر",
  guardian_national_id: "رقم هوية ولي الأمر",
  guardian_mobile: "جوال ولي الأمر",
  bank_account_number: "رقم الحساب",
  bank_account_name: "اسم الحساب",
  bank_account_type: "نوع الحساب",
  health_status: "الحالة الصحية",
  health_note: "ملاحظة صحية",
  skills: "المهارات",
  current_juz: "الجزء الحالي",
  memorized_verses: "الصفحات المحفوظة",
};

const STATUS_TABS: { value: ChangeRequestStatus | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "approved", label: "موافَق عليه" },
  { value: "rejected", label: "مرفوض" },
];

function StatusBadge({ status }: { status: ChangeRequestStatus }) {
  if (status === "approved") return <Badge variant="success">موافَق عليه</Badge>;
  if (status === "rejected") return <Badge variant="destructive">مرفوض</Badge>;
  return <Badge variant="secondary">قيد الانتظار</Badge>;
}

function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== "" && v !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-bold text-primary hover:underline"
      >
        {open ? "إخفاء التفاصيل" : "عرض التفاصيل"}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg bg-surface-subtle p-3 text-xs sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-text-muted">{FIELD_LABELS[key] ?? key}</span>
              <span className="font-bold text-text-body">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  req,
  isAdmin,
  onChanged,
}: {
  req: StudentChangeRequest;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    const res = await api.post(`/api/students/teacher-requests/${req.id}/approve/`);
    setIsApproving(false);
    if (!res.success) {
      showToast(res.error.message, "error");
      return;
    }
    showToast("تمت الموافقة على الطلب", "success");
    onChanged();
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    const res = await api.delete(`/api/students/teacher-requests/${req.id}/`);
    setIsCancelling(false);
    if (!res.success) {
      showToast(res.error.message, "error");
      return;
    }
    showToast("تم سحب الطلب", "success");
    onChanged();
  };

  return (
    <Card className="rounded-[20px] border-border-card bg-white shadow-sm">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border-card text-text-body">
              {ACTION_LABELS[req.action]}
            </Badge>
            <StatusBadge status={req.status} />
          </div>
          <span className="text-[11px] text-text-muted">
            {new Date(req.created_at).toLocaleDateString("ar-EG")}
          </span>
        </div>

        <div className="text-sm">
          <p className="font-bold text-text-title">{req.student_name}</p>
          {isAdmin && (
            <p className="text-xs text-text-muted">المحفظ: {req.teacher_name}</p>
          )}
        </div>

        <PayloadDetails payload={req.payload} />

        {req.status === "rejected" && req.note && (
          <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            سبب الرفض: {req.note}
          </p>
        )}

        {req.status === "pending" && (
          <div className="mt-2 flex items-center gap-2">
            {isAdmin ? (
              <>
                <Button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="h-9 flex-1 gap-1.5 rounded-lg text-xs font-bold"
                >
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  قبول
                </Button>
                <Button
                  onClick={() => setShowReject(true)}
                  variant="ghost"
                  className="h-9 flex-1 gap-1.5 rounded-lg bg-red-50 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                  رفض
                </Button>
              </>
            ) : (
              <Button
                onClick={handleCancel}
                disabled={isCancelling}
                variant="ghost"
                className="h-9 gap-1.5 rounded-lg bg-border-card/80 text-xs font-bold text-text-body hover:bg-border-subtle"
              >
                {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                سحب الطلب
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {showReject && (
        <RejectRequestModal
          isOpen={showReject}
          onClose={() => setShowReject(false)}
          requestId={req.id}
          onSuccess={() => {
            setShowReject(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function TeacherRequestsInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | "all">("pending");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const { data, isLoading, refetch } = useChangeRequests(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  if (isLoading && !data) return <PageLoading />;

  const requests = data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-primary">
            <ClipboardList className="h-6 w-6" />
            طلبات المحفظ
          </h1>
          <p className="text-sm text-text-muted">
            {isAdmin
              ? "مراجعة طلبات المحفظين (ضم/إزالة/تسجيل/تعديل/حذف طالب)"
              : "طلباتك المرسلة بانتظار موافقة الإدارة"}
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowAssignModal(true)} className="h-11 gap-2 rounded-xl px-4 font-bold">
            <UserPlus className="h-4 w-4" />
            طلب ضم طالب
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`h-9 rounded-lg px-3 text-xs font-bold transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-white"
                : "bg-surface-subtle text-text-body hover:bg-border-card"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border-card bg-white p-10 text-center shadow-sm">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm font-medium text-text-muted">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req} isAdmin={isAdmin} onChanged={refetch} />
          ))}
        </div>
      )}

      {showAssignModal && (
        <RequestAssignStudentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

export default function TeacherRequestsPage() {
  return (
    <RoleGate roles={["admin", "teacher"]}>
      <TeacherRequestsInner />
    </RoleGate>
  );
}
