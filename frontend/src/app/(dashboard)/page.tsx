import { Card, CardContent } from "@/components/ui/Card";
import { Users, BookOpen, Star, PlusCircle, ClipboardCheck, Bell } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Welcome Section */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl font-bold text-primary">مرحباً، مدير المركز</h1>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          نسأل الله لك التوفيق في إدارة هذه المؤسسة المباركة
        </p>
        <div className="mt-4 inline-flex items-center gap-2 border border-[#e6b150] text-[#0a528e] font-semibold bg-[#fffcf4] px-4 py-2 rounded-xl text-sm">
          <span>العام الدراسي الحالي 1447هـ - 2026م</span>
          <BookOpen className="w-4 h-4 text-[#e6b150]" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex flex-col gap-4">
        {/* Enrolled Students */}
        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">عدد الطلاب المسجلين</p>
              <h2 className="text-4xl font-black text-primary">156</h2>
            </div>
            <div className="bg-[#eef3f8] w-14 h-14 rounded-full flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Number of Rings */}
        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">عدد الحلقات</p>
              <h2 className="text-4xl font-black text-[#e6b150]">12</h2>
            </div>
            <div className="bg-[#fcf8ef] w-14 h-14 rounded-full flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-[#e6b150]" />
            </div>
          </CardContent>
        </Card>

        {/* Perfect Memorizers */}
        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-between p-5">
            <div className="text-start">
              <p className="text-xs text-slate-500 font-medium mb-1">الحفظة المتقنون</p>
              <h2 className="text-4xl font-black text-primary">23</h2>
            </div>
            <div className="bg-[#eef3f8] w-14 h-14 rounded-full flex items-center justify-center">
              <Star className="w-7 h-7 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/students/register" className="flex flex-col items-center justify-center bg-primary text-white rounded-2xl p-4 shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full border-b border-l border-white/5 disabled:pointer-events-none" />
          <PlusCircle className="w-8 h-8 z-10" />
          <div className="text-center z-10">
            <span className="block font-bold text-sm mb-0.5">تسجيل طالب جديد</span>
            <span className="block text-[10px] text-primary-50 text-white/80 max-w-[100px]">إضافة طالب جديد إلى المركز وإصدار بطاقته</span>
          </div>
        </Link>

        <Link href="/rings" className="flex flex-col items-center justify-center bg-[#e6b150] text-white rounded-2xl p-4 shadow-md shadow-[#e6b150]/20 hover:bg-[#e6b150]/90 transition-colors gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full border-b border-l border-white/5" />
          <BookOpen className="w-8 h-8 z-10" />
          <div className="text-center z-10">
            <span className="block font-bold text-sm mb-0.5">تسجيل حلقة جديدة</span>
            <span className="block text-[10px] text-white/80 max-w-[100px]">إنشاء حلقة للتحفيظ والمراجعة</span>
          </div>
        </Link>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-t-3xl border-x border-t border-slate-100 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] pt-6 pb-8 px-5 rounded-b-3xl -mx-4 md:mx-0">
        <h3 className="font-bold text-lg text-slate-900 mb-5 relative pe-4">
          أحدث النشاطات والإشعارات
          <div className="absolute top-0 bottom-0 right-0 w-1 bg-primary rounded-full" />
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
            <p className="text-sm text-slate-800 font-medium">تم تسجيل طالب جديد: أحمد محمد علي</p>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0 ms-3">
              <Bell className="w-4 h-4 text-primary" />
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
            <p className="text-sm text-slate-800 font-medium">حفظ جزء عم - الطالب: فاطمة أحمد</p>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0 ms-3">
              <Star className="w-4 h-4 text-[#2f944d]" />
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
            <p className="text-sm text-slate-800 font-medium">تحديث جدول الحضور لليوم</p>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 shrink-0 ms-3">
              <ClipboardCheck className="w-4 h-4 text-[#9333ea]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
