/**
 * Outbox: persistent queue of offline-originated writes awaiting push to
 * the server. Each row's payload is encrypted with the session key so a
 * stolen device dump is as useless as the rest of the local DB.
 */

import { encryptRecord, decryptRecord, getSessionKey } from "@/lib/db/auth";
import { getDb, type OutboxRow } from "@/lib/db/schema";
import { emitChange, type ResourceName } from "@/lib/db/events";

export type OutboxAction = "create" | "update" | "delete" | "direct_message";

// Auto-retry policy for errored ops. After MAX_ATTEMPTS the op stops
// auto-retrying (next_retry_at = null) and remains visible for manual
// dropErroredOp / retryErroredOps. Backoff is `2^attempts * 1000 ms`,
// capped at 5 minutes — keeps client polite to a sick server while
// still recovering quickly from a one-off transient failure.
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 5 * 60_000;

export interface EnqueueParams {
  resource: ResourceName;
  action: OutboxAction;
  target_id: string;
  payload: unknown;
  base_updated_at: string | null;
  client_updated_at: string;
}

export async function enqueueOp(params: EnqueueParams): Promise<OutboxRow> {
  const {
    resource,
    action,
    target_id,
    payload,
    base_updated_at,
    client_updated_at,
  } = params;

  const op_id = crypto.randomUUID();
  const now = new Date().toISOString();
  const encrypted = await encryptRecord(getSessionKey(), payload);

  const row: OutboxRow = {
    op_id,
    resource,
    action,
    target_id,
    payload_iv: encrypted.iv,
    payload_ct: encrypted.ct,
    base_updated_at,
    client_updated_at,
    created_at: now,
    status: "pending",
    attempts: 0,
    last_error: null,
    next_retry_at: null,
  };

  await getDb().outbox.put(row);
  emitChange("outbox");
  return row;
}

export async function listPending(
  limit = 50,
  nowIso = new Date().toISOString()
): Promise<OutboxRow[]> {
  const rows = await getDb()
    .outbox.where("status")
    .equals("pending")
    .toArray();
  const eligible = rows.filter(
    (row) => !row.next_retry_at || row.next_retry_at <= nowIso
  );
  return eligible
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export async function markInFlight(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  const db = getDb();
  await db.transaction("rw", db.outbox, async () => {
    for (const id of opIds) {
      await db.outbox.update(id, { status: "in_flight" });
    }
  });
  emitChange("outbox");
}

export async function revertInFlight(opIds: string[]): Promise<void> {
  if (opIds.length === 0) return;
  const db = getDb();
  await db.transaction("rw", db.outbox, async () => {
    for (const id of opIds) {
      const row = await db.outbox.get(id);
      if (row && row.status === "in_flight") {
        const status =
          (row.attempts || 0) > 0 || row.last_error !== null
            ? "error"
            : "pending";
        await db.outbox.update(id, {
          status,
        });
      }
    }
  });
  emitChange("outbox");
}

/**
 * Rescue every `in_flight` row by flipping it back to `pending` or `error`.
 *
 * Called at the top of `triggerPush` so a previous push that was killed
 * mid-flight (tab close, browser crash, 401-induced navigation, async
 * throw after `markInFlight`) doesn't permanently orphan its rows. Safe
 * because `pushInFlight === null` is the entry condition of the caller —
 * no concurrent push exists in this tab. Server-side `IdempotencyKey`
 * dedupes if the prior request actually reached the server before the
 * client died.
 */
export async function revertOrphanedInFlight(): Promise<number> {
  const db = getDb();
  const orphans = await db.outbox.where("status").equals("in_flight").toArray();
  if (orphans.length === 0) return 0;
  await db.transaction("rw", db.outbox, async () => {
    for (const row of orphans) {
      const status =
        (row.attempts || 0) > 0 || row.last_error !== null
          ? "error"
          : "pending";
      await db.outbox.update(row.op_id, {
        status,
      });
    }
  });
  emitChange("outbox");
  return orphans.length;
}

export async function markSynced(opId: string): Promise<void> {
  // Fully synced ops are dropped immediately — no use keeping them.
  await getDb().outbox.delete(opId);
  emitChange("outbox");
}

export async function markConflict(opId: string, message: string): Promise<void> {
  // Conflicts resolved locally (server row applied) — drop the op.
  void message;
  await getDb().outbox.delete(opId);
  emitChange("outbox");
}

const RESOURCE_TABLE_MAP: Partial<Record<ResourceName, string>> = {
  student: "students",
  teacher: "teachers",
  parent: "parents",
  parent_student_link: "parent_student_links",
  weekly_plan: "weekly_plans",
  daily_record: "daily_records",
  review_record: "review_records",
  evaluation: "evaluations",
  notification: "notifications",
  course: "courses",
  student_course: "student_courses",
  progress: "progress",
};

const DOMAIN_TABLE_RESOURCES: Array<{ tableName: string; resource: ResourceName }> = [
  { tableName: "weekly_plans", resource: "weekly_plan" },
  { tableName: "daily_records", resource: "daily_record" },
  { tableName: "review_records", resource: "review_record" },
  { tableName: "evaluations", resource: "evaluation" },
  { tableName: "student_courses", resource: "student_course" },
  { tableName: "parent_student_links", resource: "parent_student_link" },
  { tableName: "progress", resource: "progress" },
  { tableName: "students", resource: "student" },
  { tableName: "teachers", resource: "teacher" },
  { tableName: "parents", resource: "parent" },
  { tableName: "notifications", resource: "notification" },
  { tableName: "courses", resource: "course" },
];

function remapObjectIds(
  val: unknown,
  oldId: string,
  newId: string
): { result: unknown; changed: boolean } {
  if (val === oldId) {
    return { result: newId, changed: true };
  }
  if (Array.isArray(val)) {
    let changed = false;
    const newArr = val.map((item) => {
      const res = remapObjectIds(item, oldId, newId);
      if (res.changed) changed = true;
      return res.result;
    });
    return { result: newArr, changed };
  }
  if (val !== null && typeof val === "object") {
    let changed = false;
    const newObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const res = remapObjectIds(v, oldId, newId);
      if (res.changed) changed = true;
      newObj[k] = res.result;
    }
    return { result: newObj, changed };
  }
  return { result: val, changed: false };
}

/**
 * Replace temporary client IDs with server-assigned primary keys across
 * all pending and errored ops in the IndexedDB outbox as well as dependent
 * local domain tables in IndexedDB. Resets errored ops to 'pending' so
 * dependent ops retry automatically without user intervention.
 */
export async function remapPendingOutboxIds(
  oldId: string,
  newId: string,
  resource?: ResourceName
): Promise<void> {
  if (!oldId || !newId || oldId === newId) return;
  const db = getDb();
  const sessionKey = getSessionKey();
  if (!sessionKey) return;

  const touchedResources = new Set<ResourceName>();

  // 1. Remap dependent local domain tables
  for (const item of DOMAIN_TABLE_RESOURCES) {
    try {
      const table = db.table(item.tableName);
      const rows = (await table.toArray()) as Array<Record<string, unknown>>;
      let tableModified = false;

      for (const row of rows) {
        let rowChanged = false;
        let pkChanged = false;
        const originalId = row.id;

        if (originalId === oldId) {
          row.id = newId;
          pkChanged = true;
          rowChanged = true;
        }

        // Check clear foreign key columns / properties
        for (const [k, v] of Object.entries(row)) {
          if (k === "iv" || k === "ct") continue;
          if (v === oldId) {
            row[k] = newId;
            rowChanged = true;
          } else if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) {
              if (v[i] === oldId) {
                v[i] = newId;
                rowChanged = true;
              }
            }
          }
        }

        // Decrypt encrypted payload (iv, ct) and replace oldId with newId
        let payloadChanged = false;
        if (typeof row.iv === "string" && typeof row.ct === "string") {
          try {
            const payload = await decryptRecord<unknown>(sessionKey, {
              iv: row.iv,
              ct: row.ct,
            });
            const remapRes = remapObjectIds(payload, oldId, newId);
            if (remapRes.changed) {
              payloadChanged = true;
              const { iv, ct } = await encryptRecord(sessionKey, remapRes.result);
              row.iv = iv;
              row.ct = ct;
            }
          } catch {
            // Ignore decryption error for corrupted or un-decryptable payload
          }
        }

        if (rowChanged || payloadChanged) {
          if (pkChanged && typeof originalId === "string") {
            await table.delete(originalId);
            await table.put(row);
          } else {
            await table.put(row);
          }
          tableModified = true;
        }
      }

      if (tableModified) {
        touchedResources.add(item.resource);
      }
    } catch {
      // Best effort scanning per table
    }
  }

  if (resource) {
    try {
      const tableName = RESOURCE_TABLE_MAP[resource];
      if (tableName) {
        await db.table(tableName).delete(oldId);
      }
    } catch {
      // Best effort cleanup of temporary client ID in domain table
    }
  }

  // 2. Remap outbox payloads and target_ids
  const outboxRows = await db.outbox
    .where("status")
    .anyOf("pending", "in_flight", "error")
    .toArray();

  let outboxModified = false;
  for (const row of outboxRows) {
    try {
      const payload = await decryptRecord<unknown>(sessionKey, {
        iv: row.payload_iv,
        ct: row.payload_ct,
      });

      let changed = false;
      let target_id = row.target_id;
      if (target_id === oldId) {
        target_id = newId;
        changed = true;
      }

      const remapRes = remapObjectIds(payload, oldId, newId);
      if (remapRes.changed) {
        changed = true;
      }

      if (changed) {
        const { iv, ct } = await encryptRecord(sessionKey, remapRes.result);
        await db.outbox.update(row.op_id, {
          target_id,
          payload_iv: iv,
          payload_ct: ct,
          status: "pending",
          last_error: null,
          next_retry_at: null,
        });
        outboxModified = true;
      }
    } catch {
      // Ignore decryption error
    }
  }

  // 3. Emit Dexie change events for all modified domain tables and outbox
  for (const res of touchedResources) {
    emitChange(res);
  }
  if (outboxModified) {
    emitChange("outbox");
  }
}

export async function markError(opId: string, message: string): Promise<void> {
  const db = getDb();
  const row = await db.outbox.get(opId);
  if (!row) return;
  const attempts = (row.attempts || 0) + 1;
  const next_retry_at =
    attempts >= MAX_ATTEMPTS
      ? null
      : new Date(
          Date.now() + Math.min(2 ** attempts * BACKOFF_BASE_MS, BACKOFF_CAP_MS)
        ).toISOString();
  await db.outbox.update(opId, {
    status: "error",
    last_error: message,
    attempts,
    next_retry_at,
  });
  emitChange("outbox");
}

export async function pendingCount(): Promise<number> {
  return getDb().outbox
    .where("status")
    .anyOf("pending", "in_flight", "error")
    .count();
}

export async function errorCount(): Promise<number> {
  return getDb().outbox.where("status").equals("error").count();
}

export async function getLastError(): Promise<string | null> {
  const row = await getDb().outbox
    .where("status")
    .equals("error")
    .reverse()
    .sortBy("created_at")
    .then((rows) => rows[0]);
  return row?.last_error ?? null;
}

export async function hasPendingFor(
  resource: ResourceName,
  target_id: string
): Promise<boolean> {
  const count = await getDb().outbox
    .where("[resource+target_id]")
    .equals([resource, target_id])
    .and((row) => row.status !== "synced")
    .count();
  return count > 0;
}

export async function decryptPayload<T = unknown>(row: OutboxRow): Promise<T> {
  return decryptRecord<T>(getSessionKey(), {
    iv: row.payload_iv,
    ct: row.payload_ct,
  });
}

export async function retryErroredOps(): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.outbox, async () => {
    const errored = await db.outbox.where("status").equals("error").toArray();
    for (const row of errored) {
      await db.outbox.update(row.op_id, {
        status: "pending",
        last_error: null,
        next_retry_at: null,
        attempts: 0,
      });
    }
  });
  emitChange("outbox");
}

/**
 * Auto-retry policy for errored ops, including ones that already hit
 * `MAX_ATTEMPTS` and stopped auto-retrying. The runner calls this on the
 * `online` event and once at startup so a brief 502 / server restart / DNS
 * hiccup — or a since-fixed server bug that had permanently stuck an op —
 * doesn't leave it parked forever waiting on a manual retry button.
 *
 * Resets `attempts` to 0 and `next_retry_at` to null so the requeued op is
 * both visible to `listPending` (which filters on `next_retry_at <= now`)
 * and gets a fresh backoff budget, instead of silently no-op'ing ops that
 * were already maxed out — the exact "stuck forever" failure mode this
 * exists to recover from.
 */
export async function requeueErroredOps(): Promise<number> {
  const db = getDb();
  const errored = await db.outbox.where("status").equals("error").toArray();
  if (errored.length === 0) return 0;
  await db.transaction("rw", db.outbox, async () => {
    for (const row of errored) {
      await db.outbox.update(row.op_id, {
        status: "pending",
        last_error: null,
        next_retry_at: null,
        attempts: 0,
      });
    }
  });
  emitChange("outbox");
  return errored.length;
}

export async function dropErroredOp(opId: string): Promise<void> {
  await getDb().outbox.delete(opId);
  emitChange("outbox");
}

export async function clearErroredOps(): Promise<number> {
  const db = getDb();
  const errored = await db.outbox.where("status").equals("error").toArray();
  if (errored.length === 0) return 0;
  await db.transaction("rw", db.outbox, async () => {
    for (const row of errored) {
      await db.outbox.delete(row.op_id);
    }
  });
  emitChange("outbox");
  return errored.length;
}

/**
 * Errored ops whose backoff window has elapsed. Combined with `listPending`
 * by `triggerPush` so transient failures auto-recover without UI interaction.
 */
export async function listRetriableErrored(
  nowIso: string,
  limit = 50
): Promise<OutboxRow[]> {
  const rows = await getDb()
    .outbox.where("status")
    .equals("error")
    .filter(
      (row) =>
        row.next_retry_at !== null && row.next_retry_at !== undefined && row.next_retry_at <= nowIso
    )
    .limit(limit)
    .toArray();
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Recover ops left in `in_flight` status by a crashed or closed tab. Without
 * this, those ops are invisible to `listPending` and never retry — the
 * "stuck unsync" symptom. Called once at sync-runner startup.
 *
 * Safe to revert unconditionally at startup: this runs before the local
 * push loop starts in this session, so no in-process push owns these
 * rows. A concurrent push from another tab is also fine — server-side
 * idempotency keys reject duplicate ops.
 *
 * `attempts` is intentionally NOT incremented here: a closed tab is a
 * recovery signal, not a failure signal, and it shouldn't consume the
 * retry budget that bounds real server-side failures.
 */
export async function revertStaleInFlight(): Promise<void> {
  const db = getDb();
  let touched = false;
  await db.transaction("rw", db.outbox, async () => {
    const stuck = await db.outbox.where("status").equals("in_flight").toArray();
    for (const row of stuck) {
      const status =
        (row.attempts || 0) > 0 || row.last_error !== null
          ? "error"
          : "pending";
      await db.outbox.update(row.op_id, { status });
      touched = true;
    }
  });
  if (touched) emitChange("outbox");
}
