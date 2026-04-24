import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  illustration?: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: "default" | "soft";
};

export function EmptyState({
  title,
  description,
  icon,
  illustration,
  action,
  className,
  tone = "default",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 py-10 px-6",
        "rounded-[var(--radius-xl)] border border-[var(--color-border-card)]",
        tone === "soft" ? "bg-[var(--color-surface-subtle)]" : "bg-white",
        "motion-fade-up",
        className,
      )}
    >
      {illustration ? (
        <div aria-hidden className="text-[color:var(--color-primary)]">
          {illustration}
        </div>
      ) : icon ? (
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center w-14 h-14",
            "rounded-full bg-[var(--color-tile-blue)]",
            "text-[color:var(--color-primary)]",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-[length:var(--text-h3)] font-[700] text-[color:var(--color-text-body)]">
        {title}
      </h3>
      {description ? (
        <p className="text-[length:var(--text-small)] text-[color:var(--color-text-muted)] max-w-md">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function QuranIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="quran-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b5394" />
          <stop offset="100%" stopColor="#1e6fc4" />
        </linearGradient>
      </defs>
      <rect
        x="14"
        y="18"
        width="68"
        height="60"
        rx="10"
        fill="url(#quran-grad)"
      />
      <rect
        x="14"
        y="18"
        width="68"
        height="60"
        rx="10"
        fill="white"
        fillOpacity="0.05"
      />
      <path
        d="M48 28 L52 38 L62 39 L54 46 L56 56 L48 51 L40 56 L42 46 L34 39 L44 38 Z"
        fill="#eabd5b"
      />
      <rect x="22" y="68" width="52" height="2" rx="1" fill="white" fillOpacity="0.5" />
      <rect x="28" y="72" width="40" height="2" rx="1" fill="white" fillOpacity="0.35" />
    </svg>
  );
}

export function ClipboardIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="22" y="20" width="52" height="64" rx="8" fill="#eff6ff" stroke="#0b5394" strokeWidth="2" />
      <rect x="34" y="14" width="28" height="12" rx="4" fill="#0b5394" />
      <rect x="32" y="38" width="32" height="3" rx="1.5" fill="#0b5394" fillOpacity="0.6" />
      <rect x="32" y="48" width="24" height="3" rx="1.5" fill="#0b5394" fillOpacity="0.4" />
      <rect x="32" y="58" width="28" height="3" rx="1.5" fill="#0b5394" fillOpacity="0.4" />
      <circle cx="72" cy="72" r="12" fill="#eabd5b" />
      <path d="M67 72 L71 76 L77 68" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="48" cy="48" r="32" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
      <path d="M48 30 V48 L60 55" stroke="#b45309" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="48" r="3" fill="#b45309" />
    </svg>
  );
}

export function TrophyIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M30 20 H66 V40 C66 52 58 60 48 60 C38 60 30 52 30 40 Z"
        fill="#eabd5b"
      />
      <path
        d="M30 24 H20 V32 C20 38 25 42 30 42"
        stroke="#b45309"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M66 24 H76 V32 C76 38 71 42 66 42"
        stroke="#b45309"
        strokeWidth="2"
        fill="none"
      />
      <rect x="40" y="60" width="16" height="8" fill="#b45309" />
      <rect x="34" y="68" width="28" height="6" rx="2" fill="#b45309" />
      <path d="M42 30 L46 34 L54 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
