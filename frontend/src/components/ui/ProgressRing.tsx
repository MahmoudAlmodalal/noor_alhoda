import { cn } from "@/lib/utils";

type ProgressRingProps = {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  label?: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
};

const SIZES: Record<NonNullable<ProgressRingProps["size"]>, {
  px: number;
  stroke: number;
  textClass: string;
  subClass: string;
}> = {
  sm: { px: 72, stroke: 6, textClass: "text-[length:var(--text-large)]", subClass: "text-[length:var(--text-tiny)]" },
  md: { px: 112, stroke: 8, textClass: "text-[length:var(--text-h2)]", subClass: "text-[length:var(--text-micro)]" },
  lg: { px: 160, stroke: 10, textClass: "text-[length:var(--text-display)]", subClass: "text-[length:var(--text-small)]" },
};

const TONES: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success-text)",
  warning: "var(--color-attend-late-text)",
  danger: "var(--color-danger-text)",
};

export function ProgressRing({
  value,
  max = 100,
  size = "md",
  label,
  sublabel,
  tone = "primary",
  className,
}: ProgressRingProps) {
  const { px, stroke, textClass, subClass } = SIZES[size];
  const safeMax = Math.max(1, max);
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const strokeColor = TONES[tone];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
      role="img"
      aria-label={`${Math.round(pct)}%`}
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        className="-rotate-90"
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          stroke="var(--color-border-card)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          stroke={strokeColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={
            {
              "--ring-empty": c,
              "--ring-filled": offset,
            } as React.CSSProperties
          }
          className="motion-ring-fill"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {label !== undefined ? (
          <span
            className={cn(
              "font-[700] text-[color:var(--color-text-title)]",
              textClass,
            )}
          >
            {label ?? `${Math.round(pct)}%`}
          </span>
        ) : (
          <span
            className={cn(
              "font-[700] text-[color:var(--color-text-title)]",
              textClass,
            )}
          >
            {Math.round(pct)}%
          </span>
        )}
        {sublabel ? (
          <span className={cn("text-[color:var(--color-text-muted)]", subClass)}>
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
