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
        return <span className="text-[16px] font-bold text-[#2f944d]">ممتاز</span>;
    }
    if (value === "good") {
        return <span className="text-[16px] font-bold text-[#0b5394]">جيد جداً</span>;
    }
    if (value === "acceptable") {
        return <span className="text-[16px] font-bold text-[#ca3500]">جيد</span>;
    }
    if (value === "weak") {
        return <span className="text-[16px] font-bold text-[#c10007]">ضعيف</span>;
    }
    return <span className="text-[16px] font-bold text-[#6a7282]">-</span>;
}

export function QualityPill({ value }: { value: Quality }) {
    const styles: Record<Quality, string> = {
        excellent: "bg-[#dcfce7] text-[#008236]",
        good: "bg-[#dbeafe] text-[#1447e6]",
        acceptable: "bg-[#ffedd4] text-[#ca3500]",
        weak: "bg-[#ffe2e2] text-[#c10007]",
        none: "bg-[#f3f4f6] text-[#6a7282]",
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
                    className={`h-3.5 w-3.5 ${s <= filled ? "fill-[#eabd5b] text-[#eabd5b]" : "text-[#e5e7eb]"}`}
                />
            ))}
        </div>
    );
}
