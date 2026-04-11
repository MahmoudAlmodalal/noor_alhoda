"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, UserPlus, Users, BookOpen, LogOut, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const menuItems = [
    { name: "الرئيسية", href: "/", icon: LayoutGrid },
    { name: "تسجيل طالب", href: "/students/register", icon: UserPlus },
    { name: "إدارة المحفظين", href: "/teachers", icon: UserCheck },
    { name: "سجل الطلاب", href: "/students", icon: Users },
    { name: "إدارة الحلقات", href: "/rings", icon: BookOpen },
];

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
}

export function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const pathname = usePathname();
    const { logout } = useAuth();

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
                    <div className="px-6 space-y-2 flex-1">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

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
                                    <span>{item.name}</span>
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
