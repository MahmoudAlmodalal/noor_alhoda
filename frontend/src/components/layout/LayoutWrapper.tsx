"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import Image from "next/image";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 shadow-sm z-30">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ms-2 rounded-lg text-primary hover:bg-slate-100"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="font-bold text-primary flex items-center gap-2">
                        <span>نور الهدى</span>
                    </div>
                    <div className="w-8"></div> {/* Spacer for symmetry */}
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto pb-6">
                    <div className="container max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
