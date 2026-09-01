/**
 * Sync notices: one-line messages the sync layer needs to put in front of the
 * user. Push runs outside React (boot, `online` events, service-worker
 * wakeups), so it cannot reach `useToast` directly — it emits here and
 * `SyncNoticeListener` turns each notice into a toast.
 *
 * The case this exists for: a push that comes back `conflict` replaces the
 * local row with the server's version. Without a notice the edit silently
 * reverts a moment after the optimistic "تم الحفظ" toast, which reads as the
 * app losing the change for no reason.
 */
export type SyncNoticeType = "error" | "info";

export interface SyncNotice {
  message: string;
  type: SyncNoticeType;
}

const EVENT = "sync-notice";

const target: EventTarget =
  typeof window !== "undefined" ? new EventTarget() : ({
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  } as unknown as EventTarget);

export function emitSyncNotice(message: string, type: SyncNoticeType = "error"): void {
  target.dispatchEvent(new CustomEvent<SyncNotice>(EVENT, { detail: { message, type } }));
}

export function onSyncNotice(handler: (notice: SyncNotice) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<SyncNotice>).detail);
  target.addEventListener(EVENT, listener);
  return () => target.removeEventListener(EVENT, listener);
}
