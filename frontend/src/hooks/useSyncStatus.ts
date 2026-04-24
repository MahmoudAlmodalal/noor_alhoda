"use client";

import { useCallback, useEffect, useState } from "react";

import { onChange } from "@/lib/db/events";
import {
  errorCount,
  hasPendingFor,
  pendingCount,
} from "@/lib/sync/outbox";
import type { ResourceName } from "@/lib/db/events";

export function useSyncStatus(): { pending: number; errors: number } {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);

  const refresh = useCallback(async () => {
    const [p, e] = await Promise.all([pendingCount(), errorCount()]);
    setPending(p);
    setErrors(e);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
    const unsub = onChange("outbox", () => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return { pending, errors };
}

export function usePendingSync(
  resource: ResourceName,
  id: string | null | undefined
): boolean {
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) {
      setPending(false);
      return;
    }
    const hit = await hasPendingFor(resource, id);
    setPending(hit);
  }, [resource, id]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
    const unsub = onChange("outbox", () => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return pending;
}
