"use client";

/**
 * Offline-first read hook.
 *
 * Reads from the encrypted local Dexie DB via the query dispatcher and
 * re-runs whenever a relevant change event fires (mutation result, push
 * response, or pull update). Pages never block on the network — the
 * sync runner keeps the local DB fresh in the background.
 *
 * The hook keeps the legacy return shape (`{ data, isLoading, error,
 * refetch }`) so migration is mechanical for call sites: swap the
 * endpoint string for a (resource, params) tuple.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { onChange } from "@/lib/db/events";

import { getQueryDef, type QueryKey, type QueryParams } from "./queries";

export function useQuery<T>(
  resource: QueryKey | null,
  params?: QueryParams
) {
  const { dbUnlocked } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsRef = useRef<QueryParams | undefined>(params);
  const paramsKey = params ? JSON.stringify(params) : "";
  const latestRunRef = useRef(0);
  paramsRef.current = params;

  const run = useCallback(async () => {
    const runId = ++latestRunRef.current;

    if (!resource || !dbUnlocked) {
      if (runId === latestRunRef.current) {
        setIsLoading(false);
        setData(null);
      }
      return;
    }
    const def = getQueryDef(resource);
    if (runId === latestRunRef.current) setError(null);
    try {
      const result = await def.fn(paramsRef.current ?? {});
      // A change event can start a newer read while this one is still in
      // flight. Never let the older response overwrite fresh page data.
      if (runId === latestRunRef.current) setData(result as T);
    } catch (err) {
      if (runId === latestRunRef.current) {
        setError(err instanceof Error ? err.message : "خطأ غير متوقع");
      }
    } finally {
      if (runId === latestRunRef.current) setIsLoading(false);
    }
  }, [resource, dbUnlocked]);

  useEffect(() => {
    setIsLoading(true);
    void run();
  }, [run, paramsKey]);

  useEffect(() => {
    if (!resource || !dbUnlocked) return;
    const def = getQueryDef(resource);
    const offs = def.depends.map((r) => onChange(r, () => void run()));
    return () => {
      for (const off of offs) off();
    };
  }, [resource, dbUnlocked, run]);

  const refetch = useCallback(
    async (newParams?: QueryParams) => {
      if (newParams !== undefined) paramsRef.current = newParams;
      setIsLoading(true);
      await run();
    },
    [run]
  );

  return { data, isLoading, error, refetch };
}

/** Legacy alias — kept so the import path `@/hooks/useApi` still resolves. */
export const useApi = useQuery;
