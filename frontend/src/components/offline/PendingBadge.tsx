"use client";

import { usePendingSync } from "@/hooks/useSyncStatus";
import type { ResourceName } from "@/lib/db/events";

interface PendingBadgeProps {
  resource: ResourceName;
  id: string | null | undefined;
  className?: string;
}

export function PendingBadge({ resource, id, className }: PendingBadgeProps) {
  const pending = usePendingSync(resource, id);
  if (!pending) return null;
  return (
    <span
      role="status"
      aria-label="بانتظار المزامنة"
      title="بانتظار المزامنة"
      className={
        className ??
        "inline-block h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_0_2px_white]"
      }
    />
  );
}
