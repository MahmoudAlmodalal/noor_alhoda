import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost" | "danger" | "ghost-danger" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-[14px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50",
                    {
                        "bg-primary text-white hover:bg-primary/90": variant === "default",
                        "bg-secondary text-white hover:bg-secondary/90": variant === "secondary",
                        "border border-slate-200 bg-white hover:bg-slate-100": variant === "outline",
                        "hover:bg-slate-100 hover:text-slate-900": variant === "ghost",
                        "hover:bg-red-50 text-red-600": variant === "ghost-danger",
                        "bg-red-600 text-white hover:bg-red-700": variant === "danger",
                        "h-11 pe-4 ps-4 py-2": size === "default",
                        "h-9 rounded-[10px] pe-3 ps-3 text-xs": size === "sm",
                        "h-14 pe-8 ps-8 text-base": size === "lg",
                        "h-10 w-10": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
