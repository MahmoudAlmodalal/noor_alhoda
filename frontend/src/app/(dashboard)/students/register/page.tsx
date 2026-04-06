import { Printer, Building2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SectionTitle({ number, title }: { number: number; title: string }) {
    return (
        <div className="flex items-center gap-3 mb-5 mt-8">
            <div className="w-7 h-7 rounded-full bg-[#e6b150] text-white flex items-center justify-center text-sm font-bold shrink-0">
                {number}
            </div>
            <h3 className="font-bold text-[#e6b150] text-base shrink-0">{title}</h3>
            <div className="flex-1 h-px bg-slate-200" />
        </div>
    );
}

function SectionBand({ title }: { title: string }) {
    return (
        <div className="bg-[#e6b150] text-white font-bold text-center py-2.5 rounded-xl mb-5 mt-8 max-w-[200px] mx-auto text-sm">
            {title}
        </div>
    );
}

function FormGroup({ label, type = "text" }: { label: string; type?: string }) {
    return (
        <div className="space-y-1.5 mb-4">
            <label className="block text-sm font-medium text-slate-700">{label}</label>
            <Input type={type} className="bg-slate-50 border-slate-100 h-12 rounded-xl" />
        </div>
    );
}

function CheckboxItem({ label }: { label: string }) {
    return (
        <label className="flex items-center justify-end flex-row-reverse gap-3 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 accent-[#e6b150] bg-slate-50" />
        </label>
    );
}

export default function StudentRegistration() {
    return (
        <div className="max-w-md mx-auto space-y-6 pb-20">
            {/* Top Banner */}
            <div className="bg-gradient-to-b from-[#0a528e] to-[#084172] rounded-t-[2.5rem] rounded-b-3xl p-8 text-center text-white relative overflow-hidden shadow-lg -mx-4 md:mx-0">
                {/* Subtle background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

                <div className="relative z-10">
                    <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-5 shadow-inner p-1">
                        <div className="w-full h-full rounded-full border-2 border-dashed border-[#e6b150] flex flex-col items-center justify-center text-[#e6b150]">
                            <Building2 className="w-8 h-8" />
                        </div>
                    </div>
                    <h2 className="text-xl font-black mb-2 text-white">بطاقة الانتساب - طالب جديد</h2>
                    <p className="text-xs text-blue-100 font-medium">مركز نور الهدى لتحفيظ القرآن الكريم وعلومه</p>
                </div>
            </div>

            {/* Form Content */}
            <form className="px-2 pt-2 md:px-0">

                <SectionTitle number={1} title="البيانات الأساسية" />
                <FormGroup label="رقم الهوية:" type="number" />
                <FormGroup label="الاسم رباعي:" />
                <FormGroup label="تاريخ الميلاد:" type="date" />
                <FormGroup label="الصف الدراسي:" />
                <FormGroup label="رقم الجوال:" type="tel" />
                <FormGroup label="عنوان السكن:" />

                <SectionTitle number={2} title="بيانات ولي الأمر" />
                <FormGroup label="اسم ولي الأمر:" />
                <FormGroup label="رقم الهوية:" type="number" />
                <FormGroup label="رقم الجوال:" type="tel" />

                <SectionBand title="الحالة الصحية" />
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-4">
                    <CheckboxItem label="ابن شهيد" />
                    <CheckboxItem label="مريض" />
                    <CheckboxItem label="ابن أسير" />
                    <CheckboxItem label="أخرى" />
                </div>

                <SectionBand title="المهارات والاهتمامات" />
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-10">
                    <CheckboxItem label="قراءات قرآن" />
                    <CheckboxItem label="إنشاد" />
                    <CheckboxItem label="شعر" />
                    <CheckboxItem label="أخرى" />
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 mt-8">
                    <Button className="w-full h-14 rounded-2xl text-base font-bold shadow-md shadow-primary/20">
                        حفظ البيانات وإصدار البطاقة
                    </Button>
                    <Button variant="outline" className="w-[60%] mx-auto flex h-14 rounded-2xl text-base font-bold border-[#e6b150] text-[#e6b150] hover:bg-[#fffcf4] gap-2">
                        طباعة البطاقة
                        <Printer className="w-5 h-5" />
                    </Button>
                </div>
            </form>
        </div>
    );
}
