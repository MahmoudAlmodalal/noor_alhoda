"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutGrid,
    UserPlus,
    Users,
    BookOpen,
    BookMarked,
    LogOut,
    UserCheck,
    Bell,
    ClipboardCheck,
    Trophy,
    BarChart3,
    Database,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { UserProfile } from "@/types/api";

type Role = UserProfile["role"];

interface NavItem {
    name: string;
    href: string;
    icon: typeof LayoutGrid;
    roles: Role[];
}

export const menuItems: NavItem[] = [
    // الرئيسية — مختلفة حسب الدور
    { name: "الرئيسية", href: "/", icon: LayoutGrid, roles: ["admin", "teacher", "parent"] },
    { name: "الرئيسية", href: "/student", icon: LayoutGrid, roles: ["student"] },

    // Admin فقط
    { name: "تسجيل طالب", href: "/students/register", icon: UserPlus, roles: ["admin"] },
    { name: "إدارة المحفظين", href: "/teachers", icon: UserCheck, roles: ["admin"] },
    { name: "سجل الطلاب", href: "/students", icon: Users, roles: ["admin"] },
    { name: "قاعدة بيانات الطلاب", href: "/students-db", icon: Database, roles: ["admin"] },
    { name: "إدارة الدورات", href: "/courses", icon: BookMarked, roles: ["admin"] },
    { name: "تسجيل الحضور", href: "/attendance", icon: ClipboardCheck, roles: ["admin"] },
    { name: "لوحة الشرف", href: "/leaderboard", icon: Trophy, roles: ["admin"] },
    { name: "تقارير الحضور", href: "/reports/attendance", icon: BarChart3, roles: ["admin"] },
    { name: "الإشعارات", href: "/notifications", icon: Bell, roles: ["admin", "parent"] },

    // المحفظ فقط
    { name: "الحضور والتقييم", href: "/attendance", icon: ClipboardCheck, roles: ["teacher"] },
    { name: "خطط التسميع", href: "/plans", icon: BookOpen, roles: ["teacher"] },
    { name: "تقارير الحضور", href: "/reports/attendance", icon: BarChart3, roles: ["teacher"] },
    { name: "لوحة الشرف", href: "/leaderboard", icon: Trophy, roles: ["teacher"] },

    // الطالب فقط
    { name: "سجل الإنجاز", href: "/student/achievements", icon: Trophy, roles: ["student"] },
];

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const { unreadCount } = useNotifications();

    const visibleItems = menuItems.filter((item) =>
        user ? item.roles.includes(user.role) : true
    );

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Drawer */}
            <div
                className={cn(
                    "fixed inset-y-0 start-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block shadow-[2px_0_8px_rgba(0,0,0,0.06)] border-e border-slate-100",
                    isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
                )}
            >
                <div className="flex flex-col h-full pt-6 pb-8">
                    {/* Logo — visible on desktop; mobile sees it in the top header */}
                    <div className="px-6 pb-6 hidden lg:flex items-center justify-center">
                        <Image src="/logo.png" alt="نور الهدى" width={210} height={150} className="object-contain" />
                    </div>
                    <div className="px-4 space-y-1 flex-1 overflow-y-auto">
                        {visibleItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                            const showBadge = item.href === "/notifications" && unreadCount > 0;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-[14px] transition-colors",
                                        isActive
                                            ? "bg-primary text-white font-bold shadow-sm"
                                            : "text-primary/70 hover:bg-primary/5 hover:text-primary font-medium"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-primary/70")} />
                                    <span className="flex-1">{item.name}</span>
                                    {showBadge && (
                                        <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="px-4 mt-auto">
                        <div className="border-t border-slate-200 mb-4 px-2" />
                        <button
                            onClick={() => logout()}
                            className="flex w-full items-center space-x-reverse space-x-3 px-4 py-3 rounded-[14px] text-red-600 hover:bg-red-50 font-medium transition-colors"
                        >
                            <LogOut className="w-5 h-5 text-red-600" />
                            <span>تسجيل الخروج</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
