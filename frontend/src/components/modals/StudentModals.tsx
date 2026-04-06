import React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** 
 * 5. Assign Student Modal
 * تعيين الطالب لمحفظ
 */
export function AssignStudentModal({ isOpen, onClose, studentName }: { isOpen: boolean; onClose: () => void; studentName: string }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-bold text-primary mb-2">تعيين الطالب لمحفظ</h2>
            <p className="text-sm text-slate-500 font-medium mb-6">
                تعيين الطالب: <span className="font-bold text-slate-800">{studentName}</span>
            </p>

            <div className="space-y-1.5 mb-8">
                <label className="block text-sm font-bold text-slate-800">اختر المحفظ / الحلقة</label>
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
