"use client";

/**
 * Offline-first mutation hook.
 *
 * New contract: `useMutation(resource, action)` where
 *   - resource: "student" | "teacher" | ...
 *   - action:   "create" | "update" | "delete"
 *
 * Each mutation writes to the local encrypted Dexie tables first,
 * enqueues an operation in the outbox, emits a change event (so every
 * `useQuery` subscribed re-reads), and fires-and-forgets `triggerPush`
 * so online users see their edits sync instantly. Offline users get the
 * pending badge; the sync runner drains when connectivity returns.
 *
 * Success toast fires on the local write (the user's intent was
 * persisted durably). Server-side rejections surface later through the
 * outbox `status: "error"` UI, rendered by `useSyncStatus`.
 */

import { useCallback, useState } from "react";

import { useToast } from "@/contexts/ToastContext";
import { triggerPush } from "@/lib/sync/push";

import {
  runMutation,
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

export function useMutation<TResponse extends Record<string, unknown> = MutationResult>(
  resource: MutationResource,
  action: MutationAction
) {
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
      setIsSubmitting(true);
      setError(null);
      setFieldErrors(null);

      const res = await runMutation({
        resource,
        action,
        payload: payload ?? {},
      });

      setIsSubmitting(false);

      if (!res.ok) {
        const msg = res.error ?? "حدث خطأ غير متوقع.";
        setError(msg);
        showToast(msg, "error");
        return null;
      }

      if (!options?.silent) {
        showToast(
          options?.successMessage ?? "تمت العملية بنجاح",
          "success"
        );
      }

      // Fire-and-forget push so online users sync right away.
      void triggerPush();

      return { id: res.id ?? "" } as unknown as TResponse;
    },
    [resource, action, showToast]
  );

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors(null);
  }, []);

  return { mutate, isSubmitting, error, fieldErrors, reset };
}
