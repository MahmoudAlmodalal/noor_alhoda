/**
 * Shared repo helpers: encrypt/decrypt + upsert from pull results.
 */
import { decryptRecord, encryptRecord } from "../auth";
import { getSessionKey } from "../auth";
import type { EncryptedRow } from "../schema";

export async function decryptRow<T>(row: EncryptedRow): Promise<T> {
  return decryptRecord<T>(getSessionKey(), { iv: row.iv, ct: row.ct });
}

export async function decryptRows<T>(rows: EncryptedRow[]): Promise<T[]> {
  const key = getSessionKey();
  return Promise.all(
    rows.map((row) => decryptRecord<T>(key, { iv: row.iv, ct: row.ct }))
  );
}

export async function encryptForRow<E extends { id: string; updated_at: string }>(
  plaintext: unknown,
  extra: E
): Promise<E & { iv: string; ct: string }> {
  const blob = await encryptRecord(getSessionKey(), plaintext);
  return { ...extra, iv: blob.iv, ct: blob.ct };
}

/**
 * Resolve the LWW push base for a row about to be written locally.
 *
 * `server_updated_at` tracks the last value CONFIRMED by the server —
 * unlike `updated_at`, it must NOT be bumped by local optimistic writes,
 * or a second offline edit to the same record reads its LWW base from the
 * first edit's own client clock instead of the true last-known-server
 * value, which the server then almost always sees as stale (see
 * `mutations.ts` / `push_services.py::_server_newer_than_client`).
 *
 * Callers writing SERVER-CONFIRMED rows (push responses, pull deltas) pass
 * plain server dicts that never carry a `server_updated_at` key, so this
 * falls back to `updated_at` — which for those callers IS the confirmed
 * server value. Callers writing LOCAL optimistic edits (`hooks/mutations.ts`)
 * always set `server_updated_at` explicitly (including `null` for a
 * brand-new, not-yet-confirmed record), so that explicit value — even when
 * `null` — is used as-is instead of falling back.
 */
export function resolveServerUpdatedAt(row: {
  server_updated_at?: string | null;
  updated_at?: string | null;
}): string | null {
  return row.server_updated_at !== undefined
    ? row.server_updated_at
    : row.updated_at ?? null;
}
