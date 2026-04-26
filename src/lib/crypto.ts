// Application-layer encryption for user message content. AES-256-GCM with a
// random 12-byte IV per record; storage format is base64(IV || ciphertext+tag).
//
// Threat model: protects against D1 dumps, accidental SELECTs, and operator
// curiosity. Does NOT protect against anyone who can deploy to the Worker —
// they can write a script that loads MESSAGE_KEY and decrypts.
import type { Env } from "../env";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

let cachedKey: CryptoKey | null = null;
async function getKey(env: Env): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = b64ToBytes(env.MESSAGE_KEY);
  if (raw.length !== 32) throw new Error("MESSAGE_KEY must be 32 bytes (base64-encoded)");
  cachedKey = await crypto.subtle.importKey(
    "raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"],
  );
  return cachedKey;
}

export async function encryptMessage(env: Env, plaintext: string): Promise<string> {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return bytesToB64(out);
}

export async function decryptMessage(env: Env, b64: string): Promise<string> {
  const key = await getKey(env);
  const data = b64ToBytes(b64);
  if (data.length < 13) throw new Error("ciphertext too short");
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

