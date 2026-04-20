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
