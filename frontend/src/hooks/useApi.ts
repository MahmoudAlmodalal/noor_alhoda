"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export function useApi<T>(
  endpoint: string | null,
  params?: Record<string, string | undefined>
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    if (!endpoint) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.get<T>(endpoint, paramsRef.current, signal);

      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error.message);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError("حدث خطأ غير متوقع.");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    
    const timeoutId = window.setTimeout(() => {
      void fetchData(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchData]);

  // Allow refetch with new params
  const refetch = useCallback(async (newParams?: Record<string, string | undefined>) => {
    if (!endpoint) return;
    setIsLoading(true);
    setError(null);

    const res = await api.get<T>(endpoint, newParams ?? paramsRef.current);
    if (res.success) {
      setData(res.data);
    } else {
      setError(res.error.message);
    }
    setIsLoading(false);
  }, [endpoint]);

  return { data, isLoading, error, refetch };
}
