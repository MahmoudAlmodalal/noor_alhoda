/**
 * Outbox: persistent queue of offline-originated writes awaiting push to
 * the server. Each row's payload is encrypted with the session key so a
 * stolen device dump is as useless as the rest of the local DB.
 */

import { encryptRecord, decryptRecord, getSessionKey } from "@/lib/db/auth";
import { getDb, type OutboxRow } from "@/lib/db/schema";
import { emitChange, type ResourceName } from "@/lib/db/events";

export type OutboxAction = "create" | "update" | "delete";

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
  };

  await getDb().outbox.put(row);
  emitChange("outbox");
  return row;
}

export async function listPending(limit = 50): Promise<OutboxRow[]> {
  const rows = await getDb().outbox
    .where("status")
    .equals("pending")
    .limit(limit)
    .toArray();
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
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
        await db.outbox.update(id, {
          status: "pending",
          attempts: (row.attempts || 0) + 1,
        });
      }
    }
  });
  emitChange("outbox");
}

/**
 * Rescue every `in_flight` row by flipping it back to `pending`.
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
      await db.outbox.update(row.op_id, {
        status: "pending",
        attempts: (row.attempts || 0) + 1,
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

export async function markError(opId: string, message: string): Promise<void> {
  const db = getDb();
  const row = await db.outbox.get(opId);
  if (!row) return;
  await db.outbox.update(opId, {
    status: "error",
    last_error: message,
    attempts: (row.attempts || 0) + 1,
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
      });
    }
  });
  emitChange("outbox");
}

/**
 * Auto-retry policy for transient errors. The runner calls this on the
 * `online` event so a brief 502 / server restart / DNS hiccup doesn't
 * park an op until the user finds a manual retry button.
 *
 * Capped by `maxAttempts` (default 5) so a permanent failure (validation
 * error, schema mismatch) eventually stops looping and surfaces to the
 * user via the `error` badge for manual `dropErroredOp` / fix.
 */
export async function requeueErroredOps(maxAttempts = 5): Promise<number> {
  const db = getDb();
  const errored = await db.outbox.where("status").equals("error").toArray();
  const eligible = errored.filter((r) => (r.attempts || 0) < maxAttempts);
  if (eligible.length === 0) return 0;
  await db.transaction("rw", db.outbox, async () => {
    for (const row of eligible) {
      await db.outbox.update(row.op_id, {
        status: "pending",
        last_error: null,
      });
    }
  });
  emitChange("outbox");
  return eligible.length;
}

export async function dropErroredOp(opId: string): Promise<void> {
  await getDb().outbox.delete(opId);
  emitChange("outbox");
}
