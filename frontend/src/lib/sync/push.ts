/**
 * Push sync: drain the outbox to the server, apply per-op results, and
 * handle LWW conflicts by replacing local records with server authority.
 *
 * Triggered on app boot, on outbox writes, on `online` events, on SW
 * background-sync wakeups, and on the 30s heartbeat.
 */
import { api } from "@/lib/api";

import { hasSessionKey } from "../db/auth";
import { emitChanges, type ResourceName } from "../db/events";
import {
  upsertCourses,
  upsertEvaluations,
  upsertNotifications,
  upsertParents,
  upsertParentStudentLinks,
  upsertStudentCourses,
  upsertTeachers,
  upsertUsers,
} from "../db/repos/misc";
import {
  upsertDailyRecords,
  upsertReviewRecords,
  upsertWeeklyPlans,
} from "../db/repos/records";
import { upsertStudents } from "../db/repos/students";
import {
  decryptPayload,
  listPending,
  markConflict,
  markError,
  markInFlight,
  markSynced,
  revertInFlight,
} from "./outbox";

const BATCH_SIZE = 50;

export interface PushResult {
  ok: boolean;
  reason?: string;
}

interface PushWireOp {
  client_id: string;
  resource: string;
  op: "create" | "update" | "delete";
  id: string;
  data: unknown;
  base_updated_at: string | null;
}

interface PerOpResult {
  client_id: string;
  status: "synced" | "conflict" | "error";
  row?: Record<string, unknown>;
  /**
   * Additional server-authoritative rows from adjacent tables that the
   * client should upsert alongside `row`. Currently used by
   * `_push_teacher_create` to hand back the freshly-created user row so
   * phone_number / national_id don't wait for the next pull.
   */
  extra_rows?: Record<string, unknown>[];
  error?: { code: string; message: string };
}

interface PushResponseData {
  results: PerOpResult[];
  server_time: string;
}

let pushInFlight: Promise<PushResult> | null = null;

export function isPushInFlight(): boolean {
  return pushInFlight !== null;
}

export async function triggerPush(): Promise<PushResult> {
  if (pushInFlight !== null) return pushInFlight;
  pushInFlight = (async () => {
    try {
      if (!hasSessionKey()) return { ok: false, reason: "locked" };
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { ok: false, reason: "offline" };
      }

      // Drain loop — if one batch finishes and there's more pending, go again.
      for (let iteration = 0; iteration < 20; iteration++) {
        const pending = await listPending(BATCH_SIZE);
        if (pending.length === 0) return { ok: true };

        const ops: PushWireOp[] = [];
        for (const row of pending) {
          const payload = await decryptPayload<Record<string, unknown>>(row);
          ops.push({
            client_id: row.op_id,
            resource: row.resource,
            op: row.action,
            id: row.target_id,
            data: payload,
            base_updated_at: row.base_updated_at,
          });
        }

        const opIds = pending.map((r) => r.op_id);
        await markInFlight(opIds);

        const res = await api.post<PushResponseData>("/api/sync/push/", { ops });

        if (!res.success) {
          await revertInFlight(opIds);
          return { ok: false, reason: res.error.message };
        }

        const touched = new Set<ResourceName>();
        for (const r of res.data.results) {
          await applyResult(r, touched);
        }
        if (touched.size > 0) emitChanges(Array.from(touched));

        if (pending.length < BATCH_SIZE) return { ok: true };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      pushInFlight = null;
    }
  })();
  return pushInFlight;
}

async function applyResult(
  r: PerOpResult,
  touched: Set<ResourceName>
): Promise<void> {
  if (r.status === "synced" || r.status === "conflict") {
    if (r.row) {
      const resource = await applyServerRow(r.row);
      if (resource) touched.add(resource);
    }
    for (const extra of r.extra_rows ?? []) {
      const resource = await applyServerRow(extra);
      if (resource) touched.add(resource);
    }
    if (r.status === "synced") {
      await markSynced(r.client_id);
    } else {
      await markConflict(r.client_id, r.error?.message ?? "");
    }
    return;
  }

  // error
  await markError(r.client_id, r.error?.message ?? "خطأ غير معروف");
}

/**
 * Applies a server-authoritative row to the local DB, dispatching on the
 * `_resource` tag that the backend injects in `push_services._conflict_row`.
 * Returns the resource name so the caller can emit the right change event.
 */
async function applyServerRow(
  row: Record<string, unknown>
): Promise<ResourceName | undefined> {
  const resource = (row as { _resource?: string })._resource;
  switch (resource) {
    case "student":
      await upsertStudents([row as never]);
      return "student";
    case "teacher":
      await upsertTeachers([row as never]);
      return "teacher";
    case "parent":
      await upsertParents([row as never]);
      return "parent";
    case "parent_student_link":
      await upsertParentStudentLinks([row as never]);
      return "parent_student_link";
    case "weekly_plan":
      await upsertWeeklyPlans([row as never]);
      return "weekly_plan";
    case "daily_record":
      await upsertDailyRecords([row as never]);
      return "daily_record";
    case "review_record":
      await upsertReviewRecords([row as never]);
      return "review_record";
    case "evaluation":
      await upsertEvaluations([row as never]);
      return "evaluation";
    case "notification":
      await upsertNotifications([row as never]);
      return "notification";
    case "course":
      await upsertCourses([row as never]);
      return "course";
    case "student_course":
      await upsertStudentCourses([row as never]);
      return "student_course";
    case "user":
      // The `users` table is not in the ResourceName enum — it piggybacks
      // on "teacher"/"student"/"parent" change events via their list
      // aggregates. Emitting "teacher" covers listTeachersWithUser, which
      // is the consumer that reads user.phone_number / national_id today.
      await upsertUsers([row as never]);
      return "teacher";
    default:
      if (typeof console !== "undefined") {
        console.warn("[sync] push response row missing _resource tag:", resource);
      }
      return undefined;
  }
}

/**
 * Called by the service worker's background-sync wakeup (`message` event
 * with type "TRIGGER_PUSH"). Safe to call repeatedly — triggerPush
 * coalesces.
 */
export async function pushOnDemand(): Promise<PushResult> {
  return triggerPush();
}
