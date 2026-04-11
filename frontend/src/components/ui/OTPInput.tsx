import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    className?: string;
}

export function OTPInput({ length = 4, value, onChange, error, className }: OTPInputProps) {
    const [internalValue, setInternalValue] = useState<string[]>(Array(length).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        // Sync external value to internal array
        const valueArray = value.split('').slice(0, length);
        const newInternal = Array(length).fill('');
        valueArray.forEach((char, index) => {
            newInternal[index] = char;
        });
        setInternalValue(newInternal);
    }, [value, length]);

    const triggerChange = (newValArray: string[]) => {
        const newVal = newValArray.join('');
        onChange(newVal);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const char = e.target.value.replace(/[^0-9]/g, '').slice(-1);
        if (!char && e.target.value !== '') return; // block non-numeric

        const newInternal = [...internalValue];
        newInternal[index] = char;
        setInternalValue(newInternal);
        triggerChange(newInternal);

        // Move to next input
        if (char && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && !internalValue[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        // Handle left/right arrows for RTL or LTR
        const isRtl = document.documentElement.dir === 'rtl';
        if (e.key === 'ArrowLeft') {
            const targetIndex = isRtl ? index + 1 : index - 1;
            if (targetIndex >= 0 && targetIndex < length) {
                inputRefs.current[targetIndex]?.focus();
                e.preventDefault();
            }
        }
        if (e.key === 'ArrowRight') {
            const targetIndex = isRtl ? index - 1 : index + 1;
            if (targetIndex >= 0 && targetIndex < length) {
                inputRefs.current[targetIndex]?.focus();
                e.preventDefault();
            }
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
        if (!pastedData) return;

        const newInternal = [...internalValue];
        pastedData.split('').forEach((char, i) => {
            newInternal[i] = char;
        });
        setInternalValue(newInternal);
        triggerChange(newInternal);

        // Focus on the next empty or the last input
        const nextIndex = Math.min(pastedData.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="w-full" dir="ltr">
            <div className={cn("flex items-center justify-between gap-2 sm:gap-4", className)}>
                {internalValue.map((digit, index) => (
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
