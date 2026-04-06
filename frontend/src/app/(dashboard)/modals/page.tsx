"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
    AssignRingModal,
    AddTeacherModal,
    ConfirmDeleteModal,
    EditTeacherModal
} from "@/components/modals/TeacherModals";
import { AssignStudentModal } from "@/components/modals/StudentModals";

export default function ModalsPlayground() {
    const [activeModal, setActiveModal] = useState<string | null>(null);

    return (
        <div className="space-y-6 max-w-lg mx-auto py-10">
            <div className="text-center space-y-1 mb-6">
                <h1 className="text-2xl font-bold text-primary">معاينة النوافذ المنبثقة (Modals)</h1>
                <p className="text-sm text-slate-500">اضغط على الأزرار أدناه لمعاينة كل نافذة منبثقة</p>
            </div>

            <div className="flex flex-col gap-3">
                <Button onClick={() => setActiveModal("assignRing")} className="h-14 rounded-xl text-lg shadow-sm">
                    تعيين حلقة للمحفظ
                </Button>
                <Button onClick={() => setActiveModal("addTeacher")} className="h-14 rounded-xl text-lg shadow-sm" variant="secondary">
                    إضافة محفظ جديد
                </Button>
                <Button onClick={() => setActiveModal("confirmDelete")} className="h-14 rounded-xl text-lg shadow-sm bg-red-100 text-red-600 hover:bg-red-200">
                    تأكيد الحذف
                </Button>
                <Button onClick={() => setActiveModal("editTeacher")} className="h-14 rounded-xl text-lg shadow-sm" variant="outline">
                    تعديل بيانات المحفظ
                </Button>
                <Button onClick={() => setActiveModal("assignStudent")} className="h-14 rounded-xl text-lg shadow-sm bg-[#eefbee] text-[#2f944d] hover:bg-[#eefbee]/80">
                    تعيين الطالب لمحفظ
                </Button>
            </div>

            {/* Render Modals */}
            <AssignRingModal
                isOpen={activeModal === "assignRing"}
                onClose={() => setActiveModal(null)}
                teacherName="الشيخ محمد عبدالله"
            />

            <AddTeacherModal
                isOpen={activeModal === "addTeacher"}
                onClose={() => setActiveModal(null)}
            />

            <ConfirmDeleteModal
                isOpen={activeModal === "confirmDelete"}
                onClose={() => setActiveModal(null)}
                targetName="محمد عبدالله"
            />

            <EditTeacherModal
                isOpen={activeModal === "editTeacher"}
                onClose={() => setActiveModal(null)}
                teacher={{ id: "demo", full_name: "الشيخ محمد عبدالله", specialization: "حفص عن عاصم", session_days: [], max_students: 25, created_at: "" }}
            />

            <AssignStudentModal
                isOpen={activeModal === "assignStudent"}
                onClose={() => setActiveModal(null)}
                studentId="demo"
                studentName="أحمد محمد علي"
            />

        </div>
    );
}
