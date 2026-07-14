"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface BrowsableStudent {
  id: string;
  full_name: string;
  national_id: string;
  grade: string;
  teacher_id: string | null;
  teacher_name: string | null;
}

/**
 * Full student roster (including other teachers' students), for a teacher to
 * pick who to submit an "assign" (transfer) StudentChangeRequest for. Backed
 * by `GET /api/students/?browse_all=true` — a narrow, opt-in RBAC exception
 * (see `student_list` selector) — not part of the Dexie sync pipeline, so
 * this bypasses `useQuery` the same way `useChangeRequests` does.
 */
export function useBrowsableStudents(search: string) {
  const [data, setData] = useState<BrowsableStudent[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await api.get<BrowsableStudent[]>("/api/students/", {
      browse_all: "true",
      search: search || undefined,
    });
    if (res.success) {
      setData(res.data);
    } else {
      setError(res.error.message);
    }
    setIsLoading(false);
  }, [search]);

  useEffect(() => {
    // Fetch-on-mount/search-change for a non-Dexie resource.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  return { data, isLoading, error, refetch: run };
}
