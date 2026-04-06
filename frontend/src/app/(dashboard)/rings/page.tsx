import { Search, Plus, BookOpen, UserCog, Users, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const mockRings = [
    {
        id: 1,
        name: "حلقة الفجر",
        status: "نشط",
        teacher: "الشيخ محمد عبدالله",
        studentsCount: "2 طلاب",
        level: "تأسيس ومراجعة",
    },
    {
        id: 2,
        name: "حلقة العصر",
        status: "نشط",
        teacher: "الشيخ خالد عبدالرحمن",
        studentsCount: "1 طلاب",
        level: "مبتدئين",
    },
    {
        id: 3,
        name: "الفجر",
        status: "نشط",
        teacher: "الشيخ محمد عبدالله",
        studentsCount: "0 طلاب",
        level: "جزء عم",
    },
];

export default function RingsPage() {
    return (
        <div className="space-y-6 max-w-lg mx-auto pb-10">
            {/* Header */}
            <div className="text-center space-y-1 mb-6">
                <h1 className="text-2xl font-bold text-primary">إدارة الحلقات</h1>
                <p className="text-sm text-slate-500">إنشاء الحلقات وتعيين المحفظين والطلاب فيها</p>
            </div>

            {/* Toolbar */}
            <div className="space-y-4">
                <Input
                    icon={<Search className="w-5 h-5" />}
                    placeholder="البحث باسم الحلقة أو المحفظ..."
                    className="rounded-2xl h-14 bg-white"
                />
                <Button className="w-full h-14 rounded-2xl gap-2 font-bold text-base shadow-md shadow-primary/20">
                    إنشاء حلقة جديدة
                    <Plus className="w-5 h-5" />
                </Button>
            </div>

            {/* Rings List */}
            <div className="space-y-4">
                {mockRings.map((ring) => (
                    <Card key={ring.id} className="rounded-3xl border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] overflow-hidden pt-5 relative">
                        <CardContent className="p-5">
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">{ring.name}</h3>
                                    <Badge variant="success" className="bg-[#eefbee] text-[#2f944d] rounded-md px-3 py-0.5 font-normal">
                                        {ring.status}
                                    </Badge>
                                </div>
                                <div className="bg-[#eef3f8] w-12 h-12 rounded-full flex items-center justify-center shrink-0">
                                    <BookOpen className="w-6 h-6 text-primary" />
                                </div>
                            </div>

                            {/* Card Details */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                                        <UserCog className="w-4 h-4" />
                                        <span className="text-xs font-medium">المحفظ</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.teacher}</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                                        <Users className="w-4 h-4" />
                                        <span className="text-xs font-medium">عدد الطلاب</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.studentsCount}</span>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-400">
                                        <BookOpen className="w-4 h-4" />
                                        <span className="text-xs font-medium">المستوى</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 flex-1">{ring.level}</span>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="flex gap-3">
                                <Button variant="ghost" className="bg-[#fff4ed] text-[#e85b2e] hover:bg-[#ffe6da] hover:text-[#e85b2e] flex-1 font-bold h-12 rounded-2xl gap-2">
                                    تعديل
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-[#f43f5e] bg-[#fff1f2] hover:bg-[#ffe4e6] rounded-2xl w-12 h-12 shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
