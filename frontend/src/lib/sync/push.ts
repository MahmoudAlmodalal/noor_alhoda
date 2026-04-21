/**
 * Push sync: drain the outbox to the server, apply per-op results, and
 * handle LWW conflicts by replacing local records with server authority.
 *
 * Triggered on app boot, on outbox writes, on `online` events, on SW
 * background-sync wakeups, and on the 30s heartbeat.
 */
import { api } from "@/lib/api";

import { hasSessionKey } from "../db/auth";
import { emitChange, emitChanges, type ResourceName } from "../db/events";
import { getDb } from "../db/schema";
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
  const db = getDb();

  if (r.status === "synced") {
    if (r.row) {
      const resource = (r.row as { _resource?: string })._resource as
        | ResourceName
        | undefined;
      await applyServerRow(r.row);
      if (resource) touched.add(resource);
    }
    await markSynced(r.client_id);
    return;
  }

  if (r.status === "conflict") {
    if (r.row) {
      await applyServerRow(r.row);
    }
    await markConflict(r.client_id, r.error?.message ?? "");
    return;
  }

  // error
  await markError(r.client_id, r.error?.message ?? "خطأ غير معروف");
}

/**
 * Applies a server-authoritative row to the local DB. The row doesn't
 * carry an explicit resource tag; infer it from the shape.
 */
async function applyServerRow(row: Record<string, unknown>): Promise<void> {
  // Resource discrimination — mirror the shape checks in each repo.
  if ("teacher_id" in row && "guardian_mobile" in row) {
    await upsertStudents([row as never]);
    return;
  }
  if ("weekly_plan_id" in row && "day" in row) {
    await upsertDailyRecords([row as never]);
    return;
  }
  if ("student_id" in row && "week_start" in row) {
    await upsertWeeklyPlans([row as never]);
    return;
  }
  if ("student_id" in row && "reviewed_date" in row) {
    await upsertReviewRecords([row as never]);
    return;
  }
  if ("student_id" in row && "scheduled_date" in row) {
    await upsertEvaluations([row as never]);
    return;
  }
  if ("recipient_id" in row && "is_read" in row) {
    await upsertNotifications([row as never]);
    return;
  }
  if ("name" in row && "description" in row && !("student_id" in row)) {
    await upsertCourses([row as never]);
    return;
  }
  if ("student_id" in row && "course_id" in row) {
    await upsertStudentCourses([row as never]);
    return;
  }
  if ("parent_id" in row && "student_id" in row) {
    await upsertParentStudentLinks([row as never]);
    return;
  }
  if ("specialization" in row || "ring_name" in row) {
    await upsertTeachers([row as never]);
    return;
  }
  if ("user_id" in row && !("full_name" in row)) {
    await upsertParents([row as never]);
    return;
  }
  if ("national_id" in row && "role" in row) {
    await upsertUsers([row as never]);
    return;
  }
  // Last-ditch: still try parents (has full_name + user_id but little else).
  if ("user_id" in row && "full_name" in row) {
    await upsertParents([row as never]);
    return;
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
