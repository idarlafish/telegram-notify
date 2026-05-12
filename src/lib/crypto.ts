// Application-layer encryption for user message content. AES-256-GCM with a
// random 12-byte IV per record; storage format is base64(IV || ciphertext+tag).
//
// Threat model: protects against D1 dumps, accidental SELECTs, and operator
// curiosity. Does NOT protect against anyone who can deploy to the Worker —
// they can write a script that loads MESSAGE_KEY and decrypts.
//
// The raw primitives (importKeyFromBase64, encryptWithKey, decryptWithKey)
// are exported so the rotation script can share the exact same envelope
// format. Don't reimplement the IV layout anywhere else.
import { InternalError } from "./errors";
import type { Env } from "../env";

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export async function importKeyFromBase64(b64: string, label = "key"): Promise<CryptoKey> {
  const raw = b64ToBytes(b64);
  if (raw.length !== 32) {
    throw new InternalError(`${label} must be 32 bytes (base64-encoded), got ${raw.length}`);
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Envelope: base64( IV (12 bytes) || ciphertext+auth-tag ).
// Single source of truth for the on-disk format.
export async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return bytesToB64(out);
}

export async function decryptWithKey(key: CryptoKey, b64: string): Promise<string> {
  const data = b64ToBytes(b64);
  if (data.length < 13) throw new InternalError("ciphertext too short");
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

// Worker-side cached keys. The script has its own short-lived keys, doesn't
// need this caching.
let cachedCurrent: CryptoKey | null = null;
let cachedOld: CryptoKey | null = null;

async function getCurrentKey(env: Env): Promise<CryptoKey> {
  if (!cachedCurrent) cachedCurrent = await importKeyFromBase64(env.MESSAGE_KEY, "MESSAGE_KEY");
  return cachedCurrent;
}

async function getOldKey(env: Env): Promise<CryptoKey | null> {
  // The env.OLD_MESSAGE_KEY check MUST come before the cache check. After a
  // rotation completes and `wrangler secret delete OLD_MESSAGE_KEY` runs, the
  // isolate's `cachedOld` may still hold the old key value until eviction.
  // Returning null here when env says "no old key" prevents a deleted secret
  // from continuing to silently decrypt.
  if (!env.OLD_MESSAGE_KEY) return null;
  if (!cachedOld) cachedOld = await importKeyFromBase64(env.OLD_MESSAGE_KEY, "OLD_MESSAGE_KEY");
  return cachedOld;
}

export async function encryptMessage(env: Env, plaintext: string): Promise<string> {
  return encryptWithKey(await getCurrentKey(env), plaintext);
}

// Tries the current key first; if OLD_MESSAGE_KEY is set (rotation window),
// falls back to it. Once rotation is complete and OLD_MESSAGE_KEY is removed
// from the Worker, decrypt becomes strict-current-only again.
export async function decryptMessage(env: Env, b64: string): Promise<string> {
  const current = await getCurrentKey(env);
  try {
    return await decryptWithKey(current, b64);
  } catch (err) {
    const old = await getOldKey(env);
    if (!old) throw err;
    return decryptWithKey(old, b64);
  }
}
