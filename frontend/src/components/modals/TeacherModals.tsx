import React from "react";
import { Trash2, Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** 
 * 1. Assign Ring Modal
 * تعيين حلقة للمحفظ
 */
export function AssignRingModal({ isOpen, onClose, teacherName }: { isOpen: boolean; onClose: () => void; teacherName: string }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-bold text-primary mb-2">تعيين حلقة للمحفظ</h2>
            <p className="text-sm text-slate-500 font-medium mb-6">
                تعيين حلقة للشيخ: <span className="font-bold text-slate-800">{teacherName}</span>
            </p>

            <div className="space-y-1.5 mb-8">
                <label className="block text-sm font-bold text-slate-800">اختر الحلقة</label>
                <Input placeholder="" className="h-12 rounded-xl border-slate-200" />
            </div>

            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
                    إلغاء
                </Button>
                <Button className="flex-1 h-12 rounded-xl font-bold">
                    حفظ التعيين
                </Button>
            </div>
        </Modal>
    );
}

/** 
 * 2. Add New Teacher Modal
 * إضافة محفظ جديد
 */
export function AddTeacherModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-bold text-primary mb-6">إضافة محفظ جديد</h2>

            <form className="space-y-4 mb-8">
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">الاسم الرباعي</label>
                    <Input className="h-12 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">رقم الهوية</label>
                    <Input type="number" className="h-12 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
                    <Input type="tel" className="h-12 rounded-xl border-slate-200" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">تعيين حلقة (اختياري)</label>
                    <Input className="h-12 rounded-xl border-slate-200" />
                </div>
            </form>

            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
                    إلغاء
                </Button>
                <Button className="flex-1 h-12 rounded-xl font-bold">
                    إضافة
                </Button>
            </div>
        </Modal>
    );
}

/** 
 * 3. Confirm Deletion Modal
 * تأكيد الحذف
 */
export function ConfirmDeleteModal({ isOpen, onClose, targetName }: { isOpen: boolean; onClose: () => void; targetName: string }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} className="text-center pt-8">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-4">تأكيد الحذف</h2>
            <p className="text-lg text-slate-600 font-medium mb-8">
                هل أنت متأكد من حذف الشيخ <br /> <span className="font-bold text-primary">{targetName}</span>؟
            </p>

            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-14 rounded-2xl font-bold text-lg">
                    إلغاء
                </Button>
                <Button className="flex-1 h-14 rounded-2xl font-bold text-lg bg-[#dd1111] hover:bg-[#c00f0f] text-white">
                    نعم، احذف
                </Button>
            </div>
        </Modal>
    );
}

/** 
 * 4. Edit Teacher Data Modal
 * تعديل بيانات المحفظ
 */
export function EditTeacherModal({ isOpen, onClose, defaultData = {} }: { isOpen: boolean; onClose: () => void; defaultData?: any }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-bold text-primary mb-6">تعديل بيانات المحفظ</h2>

            <form className="space-y-4 mb-8">
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">الاسم الرباعي</label>
                    <Input defaultValue={defaultData.name || "الشيخ محمد عبدالله"} className="h-12 rounded-xl border-slate-200 font-medium" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">رقم الهوية</label>
                    <Input type="number" defaultValue={defaultData.id || "1029384756"} className="h-12 rounded-xl border-slate-200 font-medium font-sans" />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-bold text-slate-800">رقم الجوال</label>
                    <Input type="tel" defaultValue={defaultData.phone || "0501112233"} className="h-12 rounded-xl border-slate-200 font-medium font-sans" />
                </div>
            </form>

            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} className="flex-1 bg-slate-100/80 text-slate-700 hover:bg-slate-200 h-12 rounded-xl font-bold">
                    إلغاء
                </Button>
                <Button className="flex-[1.5] h-12 rounded-xl font-bold gap-2">
                    <Save className="w-5 h-5" />
                    حفظ التعديلات
                </Button>
            </div>
        </Modal>
    );
}
