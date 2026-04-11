"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/hooks/useMutation";
import type { CreateStudentRequest } from "@/types/api";

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

function FormGroup({ label, name, type = "text", value, onChange, error }: {
  label: string; name: string; type?: string; value: string; onChange: (name: string, value: string) => void; error?: string;
}) {
  return (
    <div className="space-y-1.5 mb-4">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="bg-slate-50 border-slate-100 h-12 rounded-xl"
        dir={type === "tel" || type === "number" ? "ltr" : undefined}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-end flex-row-reverse gap-3 cursor-pointer">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20 accent-[#e6b150] bg-slate-50"
      />
    </label>
  );
}

export default function StudentRegistration() {
  const router = useRouter();
  const { mutate, isSubmitting, fieldErrors } = useMutation("post", "/api/students/create/");

  const [form, setForm] = useState({
    national_id: "",
    full_name: "",
    birthdate: "",
    grade: "",
    phone_number: "",
    address: "",
    guardian_name: "",
    guardian_national_id: "",
    guardian_mobile: "",
  });

  const [health, setHealth] = useState({
    martyr_son: false,
    sick: false,
    injured: false,
    other: false,
  });

  const [skills, setSkills] = useState({
    quran: false,
    nasheed: false,
    poetry: false,
    other: false,
  });

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const getFieldError = (name: string): string | undefined => {
    if (!fieldErrors) return undefined;
    const err = fieldErrors[name];
    if (Array.isArray(err)) return err[0];
    if (typeof err === "string") return err;
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine health status
    let health_status = "normal";
    if (health.martyr_son) health_status = "martyr_son";
    else if (health.sick) health_status = "sick";
    else if (health.injured) health_status = "injured";
    else if (health.other) health_status = "other";

    const body: CreateStudentRequest = {
      ...form,
      health_status,
      skills,
      password: "nooralhuda2026",
    };

    const result = await mutate(body, { successMessage: "تم تسجيل الطالب بنجاح" });
    if (result) {
      router.push("/students");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      {/* Top Banner */}
      <div className="bg-gradient-to-b from-[#0a528e] to-[#084172] rounded-t-[2.5rem] rounded-b-3xl p-8 text-center text-white relative overflow-hidden shadow-lg -mx-4 md:mx-0">
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
      <form className="px-2 pt-2 md:px-0" onSubmit={handleSubmit}>

        <SectionTitle number={1} title="البيانات الأساسية" />
        <FormGroup label="رقم الهوية:" name="national_id" type="number" value={form.national_id} onChange={handleChange} error={getFieldError("national_id")} />
        <FormGroup label="الاسم رباعي:" name="full_name" value={form.full_name} onChange={handleChange} error={getFieldError("full_name")} />
        <FormGroup label="تاريخ الميلاد:" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} error={getFieldError("birthdate")} />
        <FormGroup label="الصف الدراسي:" name="grade" value={form.grade} onChange={handleChange} error={getFieldError("grade")} />
        <FormGroup label="رقم الجوال:" name="phone_number" type="tel" value={form.phone_number} onChange={handleChange} error={getFieldError("phone_number")} />
        <FormGroup label="عنوان السكن:" name="address" value={form.address} onChange={handleChange} error={getFieldError("address")} />

        <SectionTitle number={2} title="بيانات ولي الأمر" />
        <FormGroup label="اسم ولي الأمر:" name="guardian_name" value={form.guardian_name} onChange={handleChange} error={getFieldError("guardian_name")} />
        <FormGroup label="رقم الهوية:" name="guardian_national_id" type="number" value={form.guardian_national_id} onChange={handleChange} error={getFieldError("guardian_national_id")} />
        <FormGroup label="رقم الجوال:" name="guardian_mobile" type="tel" value={form.guardian_mobile} onChange={handleChange} error={getFieldError("guardian_mobile")} />

        <SectionBand title="الحالة الصحية" />
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-4">
          <CheckboxItem label="ابن شهيد" checked={health.martyr_son} onChange={() => setHealth({ ...health, martyr_son: !health.martyr_son })} />
          <CheckboxItem label="مريض" checked={health.sick} onChange={() => setHealth({ ...health, sick: !health.sick })} />
          <CheckboxItem label="ابن أسير" checked={health.injured} onChange={() => setHealth({ ...health, injured: !health.injured })} />
          <CheckboxItem label="أخرى" checked={health.other} onChange={() => setHealth({ ...health, other: !health.other })} />
        </div>

        <SectionBand title="المهارات والاهتمامات" />
        <div className="grid grid-cols-2 gap-y-5 gap-x-4 mb-10">
          <CheckboxItem label="قراءات قرآن" checked={skills.quran} onChange={() => setSkills({ ...skills, quran: !skills.quran })} />
          <CheckboxItem label="إنشاد" checked={skills.nasheed} onChange={() => setSkills({ ...skills, nasheed: !skills.nasheed })} />
          <CheckboxItem label="شعر" checked={skills.poetry} onChange={() => setSkills({ ...skills, poetry: !skills.poetry })} />
          <CheckboxItem label="أخرى" checked={skills.other} onChange={() => setSkills({ ...skills, other: !skills.other })} />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-8">
          <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl text-base font-bold shadow-md shadow-primary/20 gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              "حفظ البيانات وإصدار البطاقة"
            )}
          </Button>
          <Button type="button" onClick={() => window.print()} variant="outline" className="w-[60%] mx-auto flex h-14 rounded-2xl text-base font-bold border-[#e6b150] text-[#e6b150] hover:bg-[#fffcf4] gap-2">
            طباعة البطاقة
            <Printer className="w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
