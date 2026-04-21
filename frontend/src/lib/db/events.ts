/**
 * Minimal change-bus for local DB writes. Consumed by hooks so that a
 * mutation from any call path (optimistic write, pull sync, push result)
 * causes subscribed components to refetch.
 *
 * Intentionally plain EventTarget — we don't need priorities or batching.
 */

export type ResourceName =
  | "student"
  | "teacher"
  | "parent"
  | "parent_student_link"
  | "weekly_plan"
  | "daily_record"
  | "review_record"
  | "evaluation"
  | "notification"
  | "course"
  | "student_course"
  | "outbox";

const target: EventTarget =
  typeof window !== "undefined" ? new EventTarget() : (globalThis as unknown as EventTarget);

export function onChange(resource: ResourceName, cb: () => void): () => void {
  const handler = () => cb();
  target.addEventListener(resource, handler);
  return () => target.removeEventListener(resource, handler);
}

export function emitChange(resource: ResourceName): void {
  target.dispatchEvent(new Event(resource));
}

export function emitChanges(resources: ResourceName[]): void {
  for (const r of resources) emitChange(r);
}
