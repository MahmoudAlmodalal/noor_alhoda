import { Star } from "lucide-react";

export type Quality = "excellent" | "good" | "acceptable" | "weak" | "none";

export const QUALITY_LABELS: Record<Quality, string> = {
    excellent: "ممتاز",
    good: "جيد جداً",
    acceptable: "جيد",
    weak: "ضعيف",
    none: "-",
};

export const QUALITY_STARS: Record<Quality, number> = {
    excellent: 3,
    good: 2,
    acceptable: 1,
    weak: 0,
    none: 0,
};

export function QualityText({ value }: { value: Quality }) {
    if (value === "excellent") {
        return <span className="text-[16px] font-bold text-success-text">ممتاز</span>;
    }
    if (value === "good") {
        return <span className="text-[16px] font-bold text-primary">جيد جداً</span>;
    }
    if (value === "acceptable") {
        return <span className="text-[16px] font-bold text-[#ca3500]">جيد</span>;
    }
    if (value === "weak") {
        return <span className="text-[16px] font-bold text-attend-absent-text">ضعيف</span>;
    }
    return <span className="text-[16px] font-bold text-text-muted">-</span>;
}

export function QualityPill({ value }: { value: Quality }) {
    const styles: Record<Quality, string> = {
        excellent: "bg-attend-present-bg text-attend-present-text",
        good: "bg-[#dbeafe] text-[#1447e6]",
        acceptable: "bg-[#ffedd4] text-[#ca3500]",
        weak: "bg-attend-absent-bg text-attend-absent-text",
        none: "bg-border-card text-text-muted",
    };
    return (
        <span className={`inline-block rounded-[10px] px-3 py-1 text-[13px] font-bold ${styles[value]}`}>
            {QUALITY_LABELS[value]}
        </span>
    );
}

export function QualityStars({ value }: { value: Quality }) {
    const filled = QUALITY_STARS[value] ?? 0;
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3].map((s) => (
                <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${s <= filled ? "fill-secondary text-secondary" : "text-border-subtle"}`}
                />
            ))}
        </div>
    );
}
