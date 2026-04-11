"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <NotificationsProvider>
            <div className="flex h-screen overflow-hidden text-slate-900" style={{ background: "linear-gradient(104deg, #eff6ff 0%, #fff7ed 100%)" }}>
                <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Top Header (notifications + mobile menu) */}
                    <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shadow-[0px_4px_6px_0px_rgba(0,0,0,0.07)] z-30">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ms-2 rounded-lg text-primary hover:bg-slate-100 lg:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="flex items-center lg:hidden">
                            <Image src="/logo.png" alt="نور الهدى" width={82} height={44} className="object-contain" />
                        </div>

                        <div className="hidden lg:block" />

                        <div className="flex items-center gap-2">
                            <NotificationBell />
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <main className="flex-1 overflow-y-auto pb-6">
                        <div className="container max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </NotificationsProvider>
    );
}
