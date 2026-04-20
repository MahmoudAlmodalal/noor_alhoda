/**
 * Local auth helpers: password verifier and session key management.
 *
 * The verifier is a bcrypt hash of the user's password. It's used only to
 * check passwords offline — the server still authenticates via JWT on
 * first login. The hash is independent of Django's server-side password
 * hash (which we never see here).
 *
 * `sessionKey` is the unwrapped DB key held in memory for the life of the
 * session. It is zeroed out on logout.
 */

import bcrypt from "bcryptjs";

import {
  createWrappedDbKey,
  decryptRecord,
  encryptRecord,
  unwrapDbKey,
  type EncryptedBlob,
  type WrappedKeyMeta,
} from "./crypto";
import { getDb, type AuthRow } from "./schema";

const BCRYPT_COST = 10;

let sessionKey: CryptoKey | null = null;

export function getSessionKey(): CryptoKey {
  if (sessionKey === null) {
    throw new Error("DB session not unlocked — user must log in first.");
  }
  return sessionKey;
}

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

export function clearSessionKey(): void {
  sessionKey = null;
}

async function hashVerifier(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

async function checkVerifier(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function readAuth(): Promise<AuthRow | undefined> {
  return getDb().auth.get("current");
}

export async function hasCachedAuth(): Promise<boolean> {
  return (await readAuth()) !== undefined;
}

/**
 * Call after a successful ONLINE login. Generates a new DB key, derives a
 * KEK from the password, stores everything needed for later offline
 * login, and puts the unwrapped DB key into the in-memory session.
 *
 * If a previous auth row exists for a *different* user, the local DB is
 * wiped first — we never mix two users' data in the same IndexedDB.
 */
export async function initializeOrUnlockSession(params: {
  password: string;
  userId: string;
  userNationalId: string;
  userRole: string;
}): Promise<void> {
  const { password, userId, userNationalId, userRole } = params;
  const db = getDb();
  const existing = await db.auth.get("current");

  if (existing && existing.user_national_id !== userNationalId) {
    // Different user on this device — wipe all local state.
    await db.delete();
    sessionKey = null;
    // Re-open the DB after delete.
    const freshDb = getDb();
    const { dbKey, meta } = await createWrappedDbKey(password);
    const verifier = await hashVerifier(password);
    await freshDb.auth.put({
      id: "current",
      user_national_id: userNationalId,
      user_id: userId,
      user_role: userRole,
      wrapped_dbk: meta.wrapped_dbk,
      salt: meta.salt,
      iterations: meta.iterations,
      verifier_hash: verifier,
      last_sync_at: null,
      created_at: new Date().toISOString(),
    });
    sessionKey = dbKey;
    return;
  }

  if (existing) {
    // Same user — re-unwrap existing DB key, optionally refresh verifier
    // (to cover password changes that happened on another device).
    const dbKey = await unwrapDbKey(password, {
      wrapped_dbk: existing.wrapped_dbk,
      salt: existing.salt,
      iterations: existing.iterations,
    });
    sessionKey = dbKey;

    const verifierOk = await checkVerifier(password, existing.verifier_hash);
    if (!verifierOk) {
      const newVerifier = await hashVerifier(password);
      await db.auth.update("current", { verifier_hash: newVerifier });
    }
    return;
  }

  // Fresh install, first login.
  const { dbKey, meta } = await createWrappedDbKey(password);
  const verifier = await hashVerifier(password);
  await db.auth.put({
    id: "current",
    user_national_id: userNationalId,
    user_id: userId,
    user_role: userRole,
    wrapped_dbk: meta.wrapped_dbk,
    salt: meta.salt,
    iterations: meta.iterations,
    verifier_hash: verifier,
    last_sync_at: null,
    created_at: new Date().toISOString(),
  });
  sessionKey = dbKey;
}

/**
 * Verify password against the locally cached bcrypt hash, unwrap the DB
 * key, and load it into the session. Throws if the verifier fails or if
 * no auth row exists (first login must be online).
 */
export async function unlockOffline(params: {
  password: string;
  userNationalId: string;
}): Promise<AuthRow> {
  const { password, userNationalId } = params;
  const db = getDb();
  const row = await db.auth.get("current");

  if (!row) {
    throw new Error("OFFLINE_LOGIN_UNAVAILABLE");
  }
  if (row.user_national_id !== userNationalId) {
    throw new Error("OFFLINE_LOGIN_USER_MISMATCH");
  }

  const ok = await checkVerifier(password, row.verifier_hash);
  if (!ok) {
    throw new Error("OFFLINE_LOGIN_INVALID_PASSWORD");
  }

  const dbKey = await unwrapDbKey(password, {
    wrapped_dbk: row.wrapped_dbk,
    salt: row.salt,
    iterations: row.iterations,
  });
  sessionKey = dbKey;
  return row;
}

export async function markSyncAt(iso: string): Promise<void> {
  await getDb().auth.update("current", { last_sync_at: iso });
}

// Re-export crypto helpers so repos can `import { encryptRecord } from "./auth"`.
export {
  encryptRecord,
  decryptRecord,
  type EncryptedBlob,
  type WrappedKeyMeta,
};
