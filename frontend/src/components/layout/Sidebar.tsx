"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutGrid,
    UserPlus,
    Users,
    BookOpen,
    LogOut,
    UserCheck,
    Bell,
    ClipboardCheck,
    Trophy,
    BarChart3,
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
    { name: "الرئيسية", href: "/", icon: LayoutGrid, roles: ["admin", "teacher", "student", "parent"] },
    { name: "تسجيل طالب", href: "/students/register", icon: UserPlus, roles: ["admin"] },
    { name: "إدارة المحفظين", href: "/teachers", icon: UserCheck, roles: ["admin"] },
    { name: "سجل الطلاب", href: "/students", icon: Users, roles: ["admin", "teacher"] },
    { name: "إدارة الحلقات", href: "/rings", icon: BookOpen, roles: ["admin"] },
    { name: "تسجيل الحضور", href: "/attendance", icon: ClipboardCheck, roles: ["admin", "teacher"] },
    { name: "لوحة الشرف", href: "/leaderboard", icon: Trophy, roles: ["admin", "teacher", "student", "parent"] },
    { name: "تقارير الحضور", href: "/reports/attendance", icon: BarChart3, roles: ["admin", "teacher"] },
    { name: "الإشعارات", href: "/notifications", icon: Bell, roles: ["admin", "teacher", "student", "parent"] },
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
                    "fixed inset-y-0 start-0 z-50 w-72 bg-primary transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block shadow-lg border-e border-slate-100/10",
                    isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
                )}
            >
                <div className="flex flex-col h-full py-8">
                    <div className="px-6 space-y-2 flex-1 overflow-y-auto">
                        {visibleItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                            const showBadge = item.href === "/notifications" && unreadCount > 0;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl transition-colors",
                                        isActive
                                            ? "bg-white text-primary font-bold shadow-sm"
                                            : "text-white/80 hover:bg-white/10 hover:text-white font-medium"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-white/80")} />
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

                    <div className="px-6 mt-auto">
                        <div className="border-t border-white/10 mb-4 px-2" />
                        <button
                            onClick={() => logout()}
                            className="flex w-full items-center space-x-reverse space-x-3 px-4 py-3 rounded-xl text-white/90 hover:bg-white/10 hover:text-white font-medium transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>تسجيل الخروج</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
