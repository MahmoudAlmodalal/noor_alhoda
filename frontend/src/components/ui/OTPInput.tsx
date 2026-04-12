import React, { useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    className?: string;
}

export function OTPInput({ length = 4, value, onChange, error, className }: OTPInputProps) {
    const digits = Array.from({ length }, (_, i) => value[i] ?? "");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const commit = (newDigits: string[]) => {
        onChange(newDigits.join(""));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const char = e.target.value.replace(/[^0-9]/g, "").slice(-1);
        if (!char && e.target.value !== "") return;

        const newDigits = [...digits];
        newDigits[index] = char;
        commit(newDigits);

        if (char && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            if (digits[index]) {
                // Clear current slot first
                const newDigits = [...digits];
                newDigits[index] = "";
                commit(newDigits);
            } else if (index > 0) {
                // Move to previous slot and clear it
                const newDigits = [...digits];
                newDigits[index - 1] = "";
                commit(newDigits);
                inputRefs.current[index - 1]?.focus();
            }
            e.preventDefault();
            return;
        }

        const isRtl = document.documentElement.dir === "rtl";
        if (e.key === "ArrowLeft") {
            const targetIndex = isRtl ? index + 1 : index - 1;
            if (targetIndex >= 0 && targetIndex < length) {
                inputRefs.current[targetIndex]?.focus();
                e.preventDefault();
            }
        }
        if (e.key === "ArrowRight") {
            const targetIndex = isRtl ? index - 1 : index + 1;
            if (targetIndex >= 0 && targetIndex < length) {
                inputRefs.current[targetIndex]?.focus();
                e.preventDefault();
            }
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
        if (!pastedData) return;

        const newDigits = [...digits];
        pastedData.split("").forEach((char, i) => {
            newDigits[i] = char;
        });
        commit(newDigits);

        const nextIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="w-full" dir="ltr">
            <div className={cn("flex items-center justify-between gap-2 sm:gap-4", className)}>
                {digits.map((digit, index) => (
                    <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onPaste={index === 0 ? handlePaste : undefined}
                        className={cn(
                            "w-full aspect-square text-center text-xl font-bold rounded-xl border bg-white focus:outline-none focus:ring-2 transition-all",
                            error
                                ? "border-red-500 focus:ring-red-500/20 text-red-500"
                                : "border-slate-200 focus:ring-primary/20 focus:border-primary text-slate-800",
                            digit && !error ? "border-primary" : ""
                        )}
                    />
                ))}
            </div>
            {error && <p className="text-xs text-red-500 mt-2 ms-1 text-center">{error}</p>}
        </div>
    );
}
