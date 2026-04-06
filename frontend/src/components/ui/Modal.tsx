import * as React from "react"
import { cn } from "@/lib/utils"

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
}

export function Modal({ isOpen, onClose, children, className }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Dialog */}
            <div className={cn("bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-6 md:p-8 relative z-10 animate-in fade-in zoom-in-95 duration-200", className)}>
                {children}
            </div>
        </div>
    );
}
