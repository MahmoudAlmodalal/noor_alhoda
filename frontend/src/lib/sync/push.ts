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
import { upsertProgressBulk } from "../db/repos/progress";
import { emitSyncNotice } from "./notices";
import {
  decryptPayload,
  listPending,
  listRetriableErrored,
  markConflict,
  markError,
  markInFlight,
  markSynced,
  remapPendingOutboxIds,
  rebasePendingUpdates,
  revertInFlight,
  revertOrphanedInFlight,
} from "./outbox";

const BATCH_SIZE = 50;

export interface PushResult {
  ok: boolean;
  reason?: string;
}

interface PushWireOp {
  client_id: string;
  resource: string;
  op: "create" | "update" | "delete" | "direct_message";
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
let pushAgain = false;

export function isPushInFlight(): boolean {
  return pushInFlight !== null;
}

export async function triggerPush(): Promise<PushResult> {
  if (pushInFlight !== null) {
    // A mutation may be enqueued while the current batch is still in flight.
    // Keep a follow-up drain attached to the current promise so a subsequent
    // pull cannot overwrite that newer optimistic value with a stale server row.
    pushAgain = true;
    return pushInFlight;
  }
  pushInFlight = (async () => {
    try {
      if (!hasSessionKey()) return { ok: false, reason: "locked" };
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { ok: false, reason: "offline" };
      }

      // Rescue any rows left in `in_flight` by a prior push that was
      // killed mid-flight (tab close, crash, 401 → /login navigation).
      // `pushInFlight === null` is our entry condition, so any in_flight
      // row in IDB right now is by definition orphaned.
      await revertOrphanedInFlight();

      // Drain loop — if one batch finishes and there's more pending, go again.
      for (let iteration = 0; iteration < 20; iteration++) {
        // Fetch pending ops first; if room remains in the batch, top up
        // with errored ops whose backoff window has elapsed so transient
        // failures auto-recover without manual intervention.
        const pending = await listPending(BATCH_SIZE);
        const remaining = BATCH_SIZE - pending.length;
        const retriable =
          remaining > 0
            ? await listRetriableErrored(new Date().toISOString(), remaining)
            : [];
        const batch = [...pending, ...retriable];
        // Ensure causal ordering: older ops (CREATE) must precede newer
        // dependent ops (UPDATE/DELETE on the same resource).
        const actionPriority: Record<string, number> = {
          create: 0,
          update: 1,
          delete: 2,
          direct_message: 3,
        };
        batch.sort((a, b) => {
          if (a.target_id === b.target_id && a.resource === b.resource) {
            const pA = actionPriority[a.action] ?? 99;
            const pB = actionPriority[b.action] ?? 99;
            if (pA !== pB) return pA - pB;
          }
          return a.created_at.localeCompare(b.created_at);
        });
        if (batch.length === 0) return { ok: true };

        const ops: PushWireOp[] = [];
        for (const row of batch) {
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

        const opIds = batch.map((r) => r.op_id);
        const opTargetMap = new Map<string, string>(
          batch.map((r) => [r.op_id, r.target_id])
        );
        await markInFlight(opIds);

        // Inner try/finally guarantees that if anything between
        // markInFlight and the per-op resolution throws — malformed
        // server response, Dexie write failure inside applyResult, etc.
        // — the batch is reverted to pending so the next sync retries.
        // Without this, ops were stranded in `in_flight` and invisible to
        // listPending forever (the "stuck unsync" bug).
        let batchSettled = false;
        try {
          const res = await api.post<PushResponseData>("/api/sync/push/", { ops });

          if (!res.success) {
            // A batch-level rejection (e.g. the whole request failed
            // PushBatchSerializer validation) is either permanent — a 4xx,
            // meaning the request itself is malformed and retrying it
            // unchanged will fail identically forever — or transient (5xx /
            // network, code 0). Permanent rejections must NOT go back to
            // `pending`, or the batch loops forever without ever
            // incrementing `attempts`, freezing the device (see sync
            // stability incident: an unsupported `direct_message` op value
            // 400'd the whole batch and every op in it, forever).
            const code = res.error.code;
            const isPermanentRejection =
              typeof code === "number" && code >= 400 && code < 500;
            if (isPermanentRejection) {
              for (const opId of opIds) {
                await markError(opId, res.error.message);
              }
            } else {
              await revertInFlight(opIds);
            }
            batchSettled = true;
            return { ok: false, reason: res.error.message };
          }

          const touched = new Set<ResourceName>();
          for (const r of res.data.results) {
            await applyResult(r, touched, opTargetMap);
          }
          // applyResult deletes synced/conflict ops and marks errors —
          // every op in the batch is now in a terminal state (deleted or
          // status === "error"). Safe to leave the loop.
          batchSettled = true;
          if (touched.size > 0) emitChanges(Array.from(touched));

          if (batch.length < BATCH_SIZE) {
            // A mutation can enqueue another operation while this batch is
            // in flight (for example create followed immediately by edit).
            // Do not resolve yet: a pull between the two pushes could apply
            // the old server row over the newer optimistic local value.
            const morePending = await listPending(1);
            if (morePending.length === 0) return { ok: true };
          }
        } finally {
          if (!batchSettled) await revertInFlight(opIds);
        }
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      const rerun = pushAgain;
      pushAgain = false;
      pushInFlight = null;
      if (rerun) await triggerPush();
    }
  })();
  return pushInFlight;
}

/**
 * Ops already reported to the user. An errored op keeps retrying on its
 * backoff schedule, and a permanent failure would otherwise re-toast the same
 * message on every attempt.
 */
const notifiedOps = new Set<string>();
const recentNotices = new Map<string, number>();

function notifyOnce(clientId: string, message: string): void {
  if (notifiedOps.has(clientId)) return;
  notifiedOps.add(clientId);

  const now = Date.now();
  const lastTime = recentNotices.get(message);
  if (lastTime && now - lastTime < 3000) {
    return;
  }
  recentNotices.set(message, now);
  emitSyncNotice(message);
}

const PERMANENT_ERROR_CODES = new Set([
  "validation",
  "forbidden",
  "integrity",
  "bad_request",
]);

const CONFLICT_LABELS: Record<string, string> = {
  student: "بيانات الطالب",
  teacher: "بيانات المحفظ",
  parent: "بيانات ولي الأمر",
  weekly_plan: "الخطة الشهرية",
  daily_record: "السجل اليومي",
  review_record: "سجل المراجعة",
  evaluation: "الاختبار",
  course: "الدورة",
  student_course: "تسجيل الدورة",
  progress: "تقدم الحفظ",
};

function conflictMessage(row?: Record<string, unknown>, errorMessage?: string): string {
  if (errorMessage) {
    return errorMessage;
  }
  const resource = (row as { _resource?: string } | undefined)?._resource ?? "";
  const label = CONFLICT_LABELS[resource] ?? "السجل";
  return `لم يُحفظ تعديلك على ${label}: تم تعديله من جهاز آخر وأُعيدت النسخة المحفوظة على الخادم. راجع البيانات وأعد التعديل.`;
}

async function applyResult(
  r: PerOpResult,
  touched: Set<ResourceName>,
  opTargetMap?: Map<string, string>
): Promise<void> {
  if (r.status === "synced" || r.status === "conflict") {
    if (r.row) {
      const resource = await applyServerRow(r.row);
      if (resource) touched.add(resource);

      const targetId = opTargetMap?.get(r.client_id);
      const serverUpdatedAt = typeof r.row.updated_at === "string" ? r.row.updated_at : null;
      if (
        r.status === "synced" &&
        resource &&
        targetId &&
        serverUpdatedAt
      ) {
        await rebasePendingUpdates(resource, targetId, serverUpdatedAt);
      }
      if (typeof r.row.id === "string" && targetId && targetId !== r.row.id) {
        await remapPendingOutboxIds(targetId, r.row.id, resource);
      }
    }
    for (const extra of r.extra_rows ?? []) {
      const resource = await applyServerRow(extra);
      if (resource) touched.add(resource);
    }
    if (r.status === "synced") {
      await markSynced(r.client_id);
    } else {
      // The server row above has already replaced the optimistic local one,
      // so the user's edit is gone. Say so — a value that silently snaps
      // back after a success toast looks like the app dropped the change.
      notifyOnce(r.client_id, conflictMessage(r.row, r.error?.message));
      await markConflict(r.client_id, r.error?.message ?? "");
    }
    return;
  }

  // error
  // Validation / permission failures are permanent: retrying cannot fix a
  // duplicate identity number. Surface them instead of leaving the write to
  // rot in the outbox behind a badge nobody is looking at.
  if (PERMANENT_ERROR_CODES.has(r.error?.code ?? "")) {
    notifyOnce(r.client_id, r.error?.message ?? "تعذّر حفظ التعديل على الخادم.");
  }
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
    case "progress":
      await upsertProgressBulk([row as never]);
      return "progress";
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
