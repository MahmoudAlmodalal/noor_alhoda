import { Search, UserPlus, CheckCircle2, Edit, Trash2, UserCog } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const mockTeachers = [
    {
        id: 1,
        name: "الشيخ محمد عبدالله",
        phone: "0501112233",
        ring: "حلقة الفجر",
        ringColor: "success", // Just a simplified variant prop mapper
        studentsCount: 15,
    },
    {
        id: 2,
        name: "الشيخ خالد عبدالرحمن",
        phone: "0504445566",
        ring: "حلقة العصر (مبتدئين)",
        ringColor: "success",
        studentsCount: 12,
    },
    {
        id: 3,
        name: "الشيخ أحمد سعيد",
        phone: "0507778899",
        ring: "غير معين",
        ringColor: "destructive",
        studentsCount: 0,
    },
];

export default function TeachersPage() {
    return (
        <div className="space-y-6 max-w-lg mx-auto">
            {/* Header */}
            <div className="text-center space-y-1 mb-6">
                <h1 className="text-2xl font-bold text-primary">إدارة المحفظين</h1>
                <p className="text-sm text-slate-500">إضافة وتعيين الحلقات لمعلمي التحفيظ</p>
            </div>

            {/* Toolbar */}
            <div className="space-y-4">
                <Input
                    icon={<Search className="w-5 h-5" />}
                    placeholder="البحث بالاسم..."
                    className="rounded-2xl h-14"
                />
                <Button className="w-full h-14 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20">
                    إضافة محفظ جديد
                    <UserPlus className="w-5 h-5" />
                </Button>
            </div>

            {/* Teachers List */}
            <div className="space-y-4">
                {mockTeachers.map((teacher) => (
                    <Card key={teacher.id} className="rounded-3xl border-slate-100 shadow-sm overflow-hidden pt-4 relative">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                                    <UserCog className="w-6 h-6 text-primary" />
                                </div>
                                <h3 className="font-bold text-slate-900 text-lg">{teacher.name}</h3>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                                    <span className="text-sm text-slate-500 font-medium">رقم الجوال:</span>
                                    <span className="text-sm font-semibold text-slate-700">{teacher.phone}</span>
                                </div>

                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                                    <span className="text-sm text-slate-500 font-medium">الحلقة المعينة:</span>
                                    <Badge variant={teacher.ring === "غير معين" ? "destructive" : "success"} className={teacher.ring === "غير معين" ? "bg-red-100 text-red-600 rounded-lg px-3 py-1" : "bg-[#eefbee] text-[#2f944d] rounded-lg px-3 py-1"}>
                                        {teacher.ring}
                                    </Badge>
                                </div>

                                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg px-4">
                                    <span className="text-sm text-slate-500 font-medium">عدد الطلاب:</span>
                                    <span className="text-sm font-semibold text-slate-700">{teacher.studentsCount} طالب</span>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                                <Button variant="ghost" className="flex-1 text-[#2f944d] hover:bg-[#eefbee] gap-1.5 font-bold h-11 hover:text-[#2f944d]">
                                    <CheckCircle2 className="w-4 h-4" />
                                    تعيين حلقة
                                </Button>
                                <div className="w-px h-6 bg-slate-100" />
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-slate-50">
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <div className="w-px h-6 bg-slate-100" />
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
