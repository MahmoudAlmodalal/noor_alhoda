"use client";

/** Offline writes are durable and labelled pending. Online success requires
 * the server's per-operation acknowledgement, including validation and RBAC.
 */

import { useCallback, useRef, useState } from "react";

import { pullSync } from "@/lib/sync/pull";
import { useToast } from "@/contexts/ToastContext";
import { confirmOperation, OperationRejectedError } from "@/lib/sync/push";

import {
  runMutation,
  restoreRejectedMutation,
  type RunResult,
  type MutationAction,
  type MutationResource,
} from "./mutations";

export interface MutationOptions {
  successMessage?: string;
  /** Silence the success toast (for loops where many ops fire together). */
  silent?: boolean;
}

export interface MutationResult {
  id: string;
}

export function useMutation<TResponse = MutationResult>(
  resource: MutationResource,
  action: MutationAction
) {
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string | string[]> | null
  >(null);
  const { showToast } = useToast();

  const mutate = useCallback(
    async (
      payload?: Record<string, unknown>,
      options?: MutationOptions
    ): Promise<TResponse | null> => {
      if (submitting.current) return null;
      submitting.current = true;
      setIsSubmitting(true);
      setError(null);
      setFieldErrors(null);
      let res: RunResult | undefined;
      try {
        res = await runMutation({ resource, action, payload: payload ?? {} });
        if (!res.ok || !res.opId) throw new Error(res.error ?? "تعذّر حفظ التعديل.");
        const { queued } = await confirmOperation(res.opId);
        if (!queued) await pullSync();
        if (!options?.silent) {
          showToast(
            queued ? "حُفظ التعديل على الجهاز وينتظر المزامنة مع الخادم." : options?.successMessage ?? "تمت العملية بنجاح",
            queued ? "info" : "success"
          );
        }
        return { id: res.id ?? "" } as unknown as TResponse;
      } catch (err) {
        let msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
        if (err instanceof OperationRejectedError && err.permanent && res) {
          try { await restoreRejectedMutation(res); }
          catch { msg += " تعذّرت استعادة النسخة السابقة على الجهاز؛ راجع حالة المزامنة."; }
        }
        setError(msg);
        showToast(msg, "error");
        return null;
      } finally {
        submitting.current = false;
        setIsSubmitting(false);
      }
    },
    [resource, action, showToast]
  );

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors(null);
  }, []);

  return { mutate, isSubmitting, error, fieldErrors, reset };
}
