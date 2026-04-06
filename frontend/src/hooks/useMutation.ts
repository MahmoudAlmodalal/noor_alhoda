"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { ApiResponse } from "@/types/api";

export function useMutation<TResponse = unknown>(
  method: "post" | "patch" | "delete",
  defaultEndpoint?: string
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | string[]> | null>(null);
  const { showToast } = useToast();

  const mutate = useCallback(async (
    body?: unknown,
    options?: { endpoint?: string; successMessage?: string }
  ): Promise<TResponse | null> => {
    const endpoint = options?.endpoint ?? defaultEndpoint;
    if (!endpoint) {
      setError("لم يتم تحديد العنوان.");
      return null;
    }

    setIsSubmitting(true);
    setError(null);
    setFieldErrors(null);

    let res: ApiResponse<TResponse>;
    if (method === "delete") {
      res = await api.delete<TResponse>(endpoint);
    } else if (method === "patch") {
      res = await api.patch<TResponse>(endpoint, body);
    } else {
      res = await api.post<TResponse>(endpoint, body);
    }

    setIsSubmitting(false);

    if (res.success) {
      showToast(options?.successMessage ?? "تمت العملية بنجاح", "success");
      return res.data;
    }

    setError(res.error.message);
    if (res.error.details) {
      setFieldErrors(res.error.details);
    }
    showToast(res.error.message, "error");
    return null;
  }, [method, defaultEndpoint, showToast]);

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors(null);
  }, []);

  return { mutate, isSubmitting, error, fieldErrors, reset };
}
