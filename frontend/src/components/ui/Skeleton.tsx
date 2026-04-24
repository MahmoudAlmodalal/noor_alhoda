import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  rounded?: "xs" | "sm" | "md" | "lg" | "xl" | "full";
};

const RADIUS: Record<NonNullable<SkeletonProps["rounded"]>, string> = {
  xs: "rounded-[var(--radius-xs)]",
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  xl: "rounded-[var(--radius-xl)]",
  full: "rounded-full",
};

export function Skeleton({
  className,
  rounded = "md",
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("motion-skeleton", RADIUS[rounded], className)}
      {...rest}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          rounded="sm"
          className="h-3"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonStatTile({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-5 bg-white border border-[var(--color-border-card)]",
        "rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)]",
        className,
      )}
    >
      <Skeleton rounded="sm" className="h-4 w-20" />
      <Skeleton rounded="md" className="h-8 w-16" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-6 bg-white border border-[var(--color-border-card)]",
        "rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <Skeleton rounded="sm" className="h-5 w-32" />
      <SkeletonText lines={3} />
      <div className="flex gap-2">
        <Skeleton rounded="md" className="h-9 w-24" />
        <Skeleton rounded="md" className="h-9 w-20" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 bg-white border border-[var(--color-border-card)]",
        "rounded-[var(--radius-md)]",
        className,
      )}
    >
      <Skeleton rounded="full" className="h-10 w-10" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton rounded="sm" className="h-3 w-1/2" />
        <Skeleton rounded="sm" className="h-3 w-3/4" />
      </div>
      <Skeleton rounded="md" className="h-8 w-16" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <SkeletonCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonStatTile />
        <SkeletonStatTile />
      </div>
      <SkeletonCard />
    </div>
  );
}

export function WeekPlanSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <SkeletonCard />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatTile key={i} />
        ))}
      </div>
    </div>
  );
}

export function EvaluationListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
