/**
 * Encryption primitives for the offline local database.
 *
 * Scheme (KEK-wrapped DB key):
 * - On first online login, generate a random 256-bit AES key (the DB key).
 * - Derive a Key-Encryption-Key (KEK) from the user's password via PBKDF2
 *   (SHA-256, 200k iterations, 16-byte salt).
 * - Wrap the DB key with the KEK using AES-KW, persist
 *   { wrapped_dbk, salt, iterations } in the auth table.
 * - Subsequent logins (online or offline) re-derive the KEK and unwrap the
 *   DB key. Changing the password re-wraps the same DB key — the DB
 *   contents are never re-encrypted.
 *
 * Records are encrypted individually with AES-GCM (96-bit random IV) so
 * the DB remains queryable by primary key without decrypting everything.
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_LEN = 16;
const DBKEY_BITS = 256;
const GCM_IV_LEN = 12;

type Base64 = string;

function toBase64(bytes: ArrayBuffer | Uint8Array): Base64 {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < u8.length; i++) str += String.fromCharCode(u8[i]);
  return btoa(str);
}

function fromBase64(b64: Base64): Uint8Array {
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

async function deriveKek(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

export interface WrappedKeyMeta {
  wrapped_dbk: Base64;
  salt: Base64;
  iterations: number;
}

export async function createWrappedDbKey(password: string): Promise<{
  dbKey: CryptoKey;
  meta: WrappedKeyMeta;
}> {
  const salt = randomBytes(PBKDF2_SALT_LEN);
  const kek = await deriveKek(password, salt, PBKDF2_ITERATIONS);

  const dbKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: DBKEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );

  const wrappedRaw = await crypto.subtle.wrapKey("raw", dbKey, kek, { name: "AES-KW" });

  return {
    dbKey,
    meta: {
      wrapped_dbk: toBase64(wrappedRaw),
      salt: toBase64(salt),
      iterations: PBKDF2_ITERATIONS,
    },
  };
}

export async function unwrapDbKey(password: string, meta: WrappedKeyMeta): Promise<CryptoKey> {
  const kek = await deriveKek(password, fromBase64(meta.salt), meta.iterations);
  return crypto.subtle.unwrapKey(
    "raw",
    fromBase64(meta.wrapped_dbk) as unknown as BufferSource,
    kek,
    { name: "AES-KW" },
    { name: "AES-GCM", length: DBKEY_BITS },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function rewrapDbKey(
  currentPassword: string,
  newPassword: string,
  meta: WrappedKeyMeta
): Promise<WrappedKeyMeta> {
  const dbKey = await unwrapDbKey(currentPassword, meta);
  const newSalt = randomBytes(PBKDF2_SALT_LEN);
  const newKek = await deriveKek(newPassword, newSalt, PBKDF2_ITERATIONS);
  const wrappedRaw = await crypto.subtle.wrapKey("raw", dbKey, newKek, { name: "AES-KW" });
  return {
    wrapped_dbk: toBase64(wrappedRaw),
    salt: toBase64(newSalt),
    iterations: PBKDF2_ITERATIONS,
  };
}

// ---------------------------------------------------------------------------
// Per-record encryption (AES-GCM with per-record IV)
// ---------------------------------------------------------------------------

export interface EncryptedBlob {
  iv: Base64;
  ct: Base64;
}

export async function encryptRecord(
  dbKey: CryptoKey,
  plaintext: unknown
): Promise<EncryptedBlob> {
  const iv = randomBytes(GCM_IV_LEN);
  const buf = new TextEncoder().encode(JSON.stringify(plaintext));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    dbKey,
    buf as unknown as BufferSource
  );
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptRecord<T = unknown>(
  dbKey: CryptoKey,
  blob: EncryptedBlob
): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) as unknown as BufferSource },
    dbKey,
    fromBase64(blob.ct) as unknown as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
