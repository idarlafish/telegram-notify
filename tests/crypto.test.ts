import { describe, it, expect } from "vitest";
import {
  bytesToB64,
  decryptMessage,
  encryptMessage,
  encryptWithKey,
  importKeyFromBase64,
} from "../src/lib/crypto";
import type { Env } from "../src/env";

function generateKeyB64(): string {
  return bytesToB64(crypto.getRandomValues(new Uint8Array(32)));
}

function envWithKeys(messageKey: string, oldKey?: string): Env {
  return { MESSAGE_KEY: messageKey, OLD_MESSAGE_KEY: oldKey } as unknown as Env;
}

describe("encrypt/decrypt round-trip", () => {
  it("decrypts what it encrypts (current key only)", async () => {
    const env = envWithKeys(generateKeyB64());
    const ciphertext = await encryptMessage(env, "hello world");
    expect(await decryptMessage(env, ciphertext)).toBe("hello world");
  });

  it("rejects ciphertext shorter than the IV (corruption guard)", async () => {
    const env = envWithKeys(generateKeyB64());
    await expect(decryptMessage(env, "ABC")).rejects.toThrow();
  });
});

describe("decryptMessage — OLD_MESSAGE_KEY fallback (rotation window)", () => {
  it("falls back to OLD_MESSAGE_KEY when current key fails", async () => {
    const oldKey = generateKeyB64();
    const newKey = generateKeyB64();
    expect(oldKey).not.toBe(newKey);

    // Encrypt with OLD key directly (simulates a row written before rotation)
    const oldCryptoKey = await importKeyFromBase64(oldKey);
    const ciphertext = await encryptWithKey(oldCryptoKey, "encrypted under old key");

    // Worker now has both: NEW current, OLD as fallback
    const env = envWithKeys(newKey, oldKey);
    expect(await decryptMessage(env, ciphertext)).toBe("encrypted under old key");
  });

  it("throws when current fails AND OLD_MESSAGE_KEY is unset", async () => {
    const oldKey = generateKeyB64();
    const newKey = generateKeyB64();
    const oldCryptoKey = await importKeyFromBase64(oldKey);
    const ciphertext = await encryptWithKey(oldCryptoKey, "stuck on old key");

    // Post-rotation: OLD_MESSAGE_KEY removed. Decrypt should hard-fail.
    const env = envWithKeys(newKey);
    await expect(decryptMessage(env, ciphertext)).rejects.toThrow();
  });

  it("rejects malformed key at import time (label appears in error)", async () => {
    // Test importKeyFromBase64 directly so we bypass the module-level
    // `cachedCurrent` from previous tests in this file.
    await expect(
      importKeyFromBase64("dGhpcy1pcy10b28tc2hvcnQ=", "MESSAGE_KEY"),
    ).rejects.toThrow(/MESSAGE_KEY.*32 bytes/);
  });
});
