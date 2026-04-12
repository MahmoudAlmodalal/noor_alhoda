import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

interface DailyEvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName?: string;
}

export function DailyEvaluationModal({ isOpen, onClose, studentName }: DailyEvaluationModalProps) {
    const [attendance, setAttendance] = useState<"حاضر" | "متأخر" | "غائب" | "مستأذن" | null>(null);

    const attendanceOptions: ("حاضر" | "متأخر" | "غائب" | "مستأذن")[] = ["حاضر", "متأخر", "غائب", "مستأذن"];

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="max-w-md w-full !rounded-3xl !p-0 overflow-hidden bg-slate-50/50">
            <div className="p-6 md:p-8 space-y-6">

                {/* Attendance Section */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    {studentName && (
                        <p className="text-sm text-slate-500 mb-4">
                            تقييم الطالب: <span className="font-bold text-slate-800">{studentName}</span>
                        </p>
                    )}
                    <h3 className="font-bold text-slate-800 text-lg mb-4 text-start">حالة الحضور</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {attendanceOptions.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setAttendance(option)}
                                className={`py-2 px-4 rounded-xl border text-sm font-bold transition-colors ${attendance === option
                                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Today's Memorization Section */}
                <div className="bg-[#fcf8ef]/50 rounded-2xl p-5 shadow-sm border border-blue-100/50">
                    <h3 className="font-bold text-primary text-lg mb-4 text-start">تسميع حفظ اليوم</h3>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 block text-start">اسم السورة</label>
                            <Input
                                placeholder="مثال: البقرة"
                                className="bg-white border-blue-100/50 rounded-xl"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 block text-start">من آية</label>
                                <Input
                                    placeholder="رقم"
                                    className="bg-white border-blue-100/50 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700 block text-start">إلى آية</label>
                                <Input
                                    placeholder="رقم"
                                    className="bg-white border-blue-100/50 rounded-xl"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 block text-start">تقييم الحفظ الجديد</label>
                            <Input
                                placeholder=""
                                className="bg-white border-blue-100/50 rounded-xl"
                            />
                        </div>
                    </div>
                </div>

                {/* Revision Section */}
                <div className="bg-green-50/50 rounded-2xl p-5 shadow-sm border border-green-100">
                    <h3 className="font-bold text-green-700 text-lg mb-4 text-start">تسميع المراجعة</h3>
                    {/* Form fields for revision could go here, similar to above */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700 block text-start">اسم السورة</label>
                            <Input
                                placeholder="مثال: آل عمران"
                                className="bg-white border-green-100 rounded-xl"
                            />
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button className="w-full bg-primary text-white font-bold py-3.5 rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 transition-all mt-4">
                    حفظ التقييم
                </button>

            </div>
        </Modal>
    );
}
