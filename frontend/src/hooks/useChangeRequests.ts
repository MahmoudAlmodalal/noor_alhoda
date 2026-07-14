"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChangeRequestAction, ChangeRequestStatus, StudentChangeRequest } from "@/types/api";

/**
 * StudentChangeRequest list — not part of the Dexie offline sync pipeline
 * (this is a live admin/teacher review queue, not something to cache
 * offline), so this deliberately bypasses `useQuery` and calls the API
 * directly, same as `AnnounceModal.tsx` does for the `announce` fan-out.
 */
export function useChangeRequests(params?: { status?: ChangeRequestStatus; action?: ChangeRequestAction }) {
  const [data, setData] = useState<StudentChangeRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.get<StudentChangeRequest[]>("/api/students/teacher-requests/", {
      status: params?.status,
      action: params?.action,
    });
    if (res.success) {
      setData(res.data);
    } else {
      setError(res.error.message);
    }
    setIsLoading(false);
  }, [params?.status, params?.action]);

  useEffect(() => {
    // Fetch-on-mount for a non-Dexie resource (no external store to sync from).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  return { data, isLoading, error, refetch: run };
}
