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
  rewrapDbKey,
  unwrapDbKey,
  type EncryptedBlob,
  type WrappedKeyMeta,
} from "./crypto";
import { getDb, wipeDb, type AuthRow } from "./schema";

const BCRYPT_COST = 10;
const SESSION_STORAGE_KEY = "_dbk";

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
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

// Persist the current session key in sessionStorage as JWK so it survives a
// page reload within the same tab. sessionStorage is cleared when the tab
// closes, which matches the "log out on tab close" model we want.
async function persistSessionKey(key: CryptoKey): Promise<void> {
  if (typeof sessionStorage === "undefined") return;
  try {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(jwk));
  } catch {
    // exportKey fails if the key is non-extractable — nothing we can do.
  }
}

// Restore the session key from sessionStorage if present. Returns true on
// success. Caller must still verify that a matching auth row exists.
export async function restoreSessionKey(): Promise<boolean> {
  if (sessionKey !== null) return true;
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return false;
  try {
    const jwk = JSON.parse(raw) as JsonWebKey;
    sessionKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return false;
  }
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
  console.log("[auth] initializeOrUnlockSession start");
  console.time("[auth] getDb");
  const db = getDb();
  console.timeEnd("[auth] getDb");

  console.time("[auth] read existing auth row");
  const existing = await db.auth.get("current");
  console.timeEnd("[auth] read existing auth row");
  console.log("[auth] existing row:", existing ? "found" : "none", existing?.user_national_id);

  if (existing && existing.user_national_id !== userNationalId) {
    // Different user on this device — wipe all local state.
    console.log("[auth] user mismatch — wiping DB");
    console.time("[auth] db.delete");
    await wipeDb();
    console.timeEnd("[auth] db.delete");
    sessionKey = null;
    // Re-open the DB after delete.
    const freshDb = getDb();
    console.time("[auth] createWrappedDbKey (fresh)");
    const { dbKey, meta } = await createWrappedDbKey(password);
    console.timeEnd("[auth] createWrappedDbKey (fresh)");
    console.time("[auth] hashVerifier (fresh)");
    const verifier = await hashVerifier(password);
    console.timeEnd("[auth] hashVerifier (fresh)");
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
      sync_generation: null,
      created_at: new Date().toISOString(),
    });
    sessionKey = dbKey;
    await persistSessionKey(dbKey);
    console.log("[auth] initializeOrUnlockSession done (fresh after wipe)");
    return;
  }

  if (existing) {
    // Same user — re-unwrap existing DB key, optionally refresh verifier
    // (to cover password changes that happened on another device).
    console.time("[auth] unwrapDbKey");
    const dbKey = await unwrapDbKey(password, {
      wrapped_dbk: existing.wrapped_dbk,
      salt: existing.salt,
      iterations: existing.iterations,
    });
    console.timeEnd("[auth] unwrapDbKey");
    sessionKey = dbKey;
    await persistSessionKey(dbKey);

    console.time("[auth] checkVerifier");
    const verifierOk = await checkVerifier(password, existing.verifier_hash);
    console.timeEnd("[auth] checkVerifier");
    if (!verifierOk) {
      console.time("[auth] hashVerifier (refresh)");
      const newVerifier = await hashVerifier(password);
      console.timeEnd("[auth] hashVerifier (refresh)");
      await db.auth.update("current", { verifier_hash: newVerifier });
    }
    console.log("[auth] initializeOrUnlockSession done (existing user)");
    return;
  }

  // Fresh install, first login.
  console.time("[auth] createWrappedDbKey");
  const { dbKey, meta } = await createWrappedDbKey(password);
  console.timeEnd("[auth] createWrappedDbKey");
  console.time("[auth] hashVerifier");
  const verifier = await hashVerifier(password);
  console.timeEnd("[auth] hashVerifier");
  console.time("[auth] auth.put");
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
    sync_generation: null,
    created_at: new Date().toISOString(),
  });
  console.timeEnd("[auth] auth.put");
  sessionKey = dbKey;
  await persistSessionKey(dbKey);
  console.log("[auth] initializeOrUnlockSession done (fresh install)");
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
  await persistSessionKey(dbKey);
  return row;
}

/**
 * Re-wrap the local DB key under a new password after a self-service
 * password change has already succeeded server-side. Throws
 * `OFFLINE_LOGIN_INVALID_PASSWORD` if `currentPassword` doesn't unwrap the
 * existing key (e.g. stale cache) — caller should treat that as non-fatal
 * since the server-side change already went through.
 */
export async function changeLocalPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = getDb();
  const row = await db.auth.get("current");
  if (!row) return;

  let newMeta: WrappedKeyMeta;
  try {
    newMeta = await rewrapDbKey(currentPassword, newPassword, {
      wrapped_dbk: row.wrapped_dbk,
      salt: row.salt,
      iterations: row.iterations,
    });
  } catch {
    throw new Error("OFFLINE_LOGIN_INVALID_PASSWORD");
  }

  const newVerifier = await hashVerifier(newPassword);
  await db.auth.update("current", {
    wrapped_dbk: newMeta.wrapped_dbk,
    salt: newMeta.salt,
    iterations: newMeta.iterations,
    verifier_hash: newVerifier,
  });
}

export async function markSyncAt(iso: string): Promise<void> {
  await getDb().auth.update("current", { last_sync_at: iso });
}

export async function updateSyncGeneration(generation: string): Promise<void> {
  await getDb().auth.update("current", { sync_generation: generation });
}

/**
 * Reset the delta cursor to "full pull" and adopt the server's new generation,
 * without dropping the auth row (the DB key + offline-login material). Used by
 * the pull sync when the server's sync_generation changes (server DB reset).
 */
export async function resetSyncStateForGeneration(generation: string): Promise<void> {
  await getDb().auth.update("current", {
    last_sync_at: null,
    sync_generation: generation,
  });
}

// Re-export crypto helpers so repos can `import { encryptRecord } from "./auth"`.
export {
  encryptRecord,
  decryptRecord,
  type EncryptedBlob,
  type WrappedKeyMeta,
};
