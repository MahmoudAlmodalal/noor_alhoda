import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    endIcon?: React.ReactNode;
    error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, icon, endIcon, error, ...props }, ref) => {
        return (
            <div className="w-full">
                <div className="relative flex items-center">
                    {icon && (
                        <div className="absolute start-4 text-slate-400 pointer-events-none flex items-center justify-center">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            "flex h-[51px] w-full rounded-[14px] border bg-[#f9fafb] px-4 py-3 text-base text-[#1e2939] ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#0a0a0a]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                            error ? "border-red-500 focus-visible:ring-red-500/20" : "border-[#e5e7eb]",
                            icon && "ps-12",
                            endIcon && "pe-12",
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                    {endIcon && (
                        <div className="absolute end-3 text-slate-400 flex items-center justify-center">
                            {endIcon}
                        </div>
                    )}
                </div>
                {error && <p className="text-xs text-red-500 mt-1 ms-1">{error}</p>}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
