import { Search, UserCog, Edit, Trash2, FileText, User } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const mockStudents = [
    {
        id: "1029384756",
        name: "أحمد محمد علي",
        level: "جزء عم",
        teacher: "الشيخ محمد عبدالله",
        grade: "الصف الأول المتوسط",
        status: "نشط",
    },
    {
        id: "1092837465",
        name: "عمر عبدالله سالم",
        level: "جزء تبارك",
        teacher: "غير معين",
        grade: "الصف الثالث الابتدائي",
        status: "نشط",
    },
    {
        id: "1039485761",
        name: "خالد عبدالعزيز",
        level: "5 أجزاء",
        teacher: "الشيخ خالد عبدالرحمن",
        grade: "الصف الثاني الثانوي",
        status: "منقطع",
    },
];

export default function StudentsPage() {
    return (
        <div className="space-y-6 max-w-lg mx-auto">
            {/* Header */}
            <div className="text-center space-y-1 mb-6">
                <h1 className="text-2xl font-bold text-primary">سجل الطلاب</h1>
                <p className="text-sm text-slate-500">إدارة ومتابعة جميع الطلاب المسجلين بالمركز</p>
            </div>

            {/* Toolbar */}
            <div className="space-y-4">
                <Input
                    icon={<Search className="w-5 h-5" />}
                    placeholder="البحث بالاسم أو الهوية..."
                    className="rounded-2xl h-14 bg-slate-50/50"
                />
            </div>

            {/* Students List */}
            <div className="space-y-4">
                {mockStudents.map((student) => (
                    <Card key={student.id} className="rounded-3xl border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden pt-4 relative bg-white">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{student.name}</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">{student.id}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mb-6">
                                <div className="bg-slate-50/80 p-3 rounded-xl">
                                    <span className="block text-[11px] text-slate-500 font-medium mb-1">المستوى/الحفظ:</span>
                                    <span className="block text-sm font-bold text-slate-800">{student.level}</span>
                                </div>

                                <div className="bg-slate-50/80 p-3 rounded-xl">
                                    <span className="block text-[11px] text-slate-500 font-medium mb-1">المحفظ:</span>
                                    <Badge variant={student.teacher === "غير معين" ? "destructive" : "secondary"} className={student.teacher === "غير معين" ? "font-normal bg-red-50 text-red-600 px-2.5 py-0.5 rounded-md" : "bg-[#eef3f8] text-primary hover:bg-[#eef3f8] font-normal px-2.5 py-0.5 rounded-md"}>
                                        {student.teacher}
                                    </Badge>
                                </div>

                                <div className="bg-slate-50/80 p-3 rounded-xl">
                                    <span className="block text-[11px] text-slate-500 font-medium mb-1">الصف الدراسي:</span>
                                    <span className="block text-sm font-bold text-slate-800 line-clamp-1">{student.grade}</span>
                                </div>

                                <div className="bg-slate-50/80 p-3 rounded-xl">
                                    <span className="block text-[11px] text-slate-500 font-medium mb-1">الحالة:</span>
                                    <Badge variant={student.status === "نشط" ? "success" : "destructive"} className={student.status === "نشط" ? "font-normal bg-[#eefbee] text-[#2f944d] rounded-md px-3 py-0.5" : "bg-red-100 text-red-600 rounded-md px-3 py-0.5 font-normal"}>
                                        {student.status}
                                    </Badge>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 px-2">
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10">
                                        <UserCog className="w-[18px] h-[18px]" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10">
                                        <FileText className="w-[18px] h-[18px]" />
                                    </Button>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg w-10 h-10">
                                        <Edit className="w-[18px] h-[18px]" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg w-10 h-10">
                                        <Trash2 className="w-[18px] h-[18px]" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
