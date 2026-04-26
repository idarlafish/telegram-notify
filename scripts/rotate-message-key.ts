// Rotate MESSAGE_KEY by re-encrypting every notification's `message` column.
// Idempotent — already-NEW rows decrypt cleanly with NEW and are no-ops.
//
// Procedure (do these BEFORE running the script):
//   0. Take a backup:
//        bunx wrangler d1 export telegram-notify-db --remote --output=pre-rotation.sql
//   1. Generate new key:  openssl rand -base64 32
//   2. wrangler secret put OLD_MESSAGE_KEY  (paste current MESSAGE_KEY value)
//   3. wrangler secret put MESSAGE_KEY      (paste new value)
//   4. bun run deploy   — Worker now decrypts NEW preferring, falls back to OLD
//
// Run:
//   NEW_KEY=<base64> OLD_KEY=<base64> bun run scripts/rotate-message-key.ts --dry-run
//   NEW_KEY=<base64> OLD_KEY=<base64> bun run scripts/rotate-message-key.ts
//
// AFTER successful run:
//   5. wrangler secret delete OLD_MESSAGE_KEY  — strict-current-only again
//   6. bun run deploy
//
// Concurrency: the UPDATE uses optimistic concurrency control via the
// original ciphertext as a guard (`WHERE id=? AND message=?`). If the Worker
// PATCHes the row mid-rotation (changing the message), our UPDATE matches 0
// rows and the row is reported as a conflict. Re-running the script picks it
// up cleanly; nothing is lost.
import { spawnSync } from "node:child_process";
import {
  decryptWithKey,
  encryptWithKey,
  importKeyFromBase64,
} from "../src/lib/crypto";

const newKey = process.env.NEW_KEY;
const oldKey = process.env.OLD_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!newKey || !oldKey) {
  console.error("NEW_KEY and OLD_KEY (both base64-encoded 32-byte AES keys) required");
  process.exit(1);
}
if (newKey === oldKey) {
  console.error("NEW_KEY and OLD_KEY are identical — nothing to rotate. Refusing to run.");
  process.exit(1);
}

const newCryptoKey = await importKeyFromBase64(newKey, "NEW_KEY");
const oldCryptoKey = await importKeyFromBase64(oldKey, "OLD_KEY");

async function decryptWithFallback(b64: string): Promise<{ plaintext: string; wasNew: boolean }> {
  try {
    return { plaintext: await decryptWithKey(newCryptoKey, b64), wasNew: true };
  } catch {
    return { plaintext: await decryptWithKey(oldCryptoKey, b64), wasNew: false };
  }
}

function d1(cmd: string): { results?: { meta?: { changes?: number }; results?: unknown[] }[] } {
  const r = spawnSync("bunx", [
    "wrangler", "d1", "execute", "telegram-notify-db",
    "--remote", "--json", "--command", cmd,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    throw new Error(`wrangler d1 execute failed: ${r.stderr.toString()}`);
  }
  // Surface non-fatal stderr (deprecation warnings, rate-limit notices) — wrangler
  // exits 0 even when noisy, and silent suppression hides forward-compat signals.
  const stderr = r.stderr.toString().trim();
  if (stderr) console.warn(`  [wrangler stderr] ${stderr.split("\n").join("\n  [wrangler stderr] ")}`);
  return JSON.parse(r.stdout.toString());
}

const result = d1("SELECT id, message FROM notifications") as Array<{
  results: { id: string; message: string }[];
}>;
const rows = result[0]?.results ?? [];
console.log(`mode: ${dryRun ? "DRY-RUN" : "LIVE"}, found ${rows.length} rows\n`);

const sqlEscape = (s: string) => s.replace(/'/g, "''");

let migrated = 0;
let alreadyNew = 0;
const failures: { id: string; reason: string }[] = [];
const conflicts: string[] = [];

for (const row of rows) {
  try {
    const { plaintext, wasNew } = await decryptWithFallback(row.message);
    if (wasNew) {
      console.log(`  skip ${row.id} (already on new key)`);
      alreadyNew++;
      continue;
    }
    const reEncrypted = await encryptWithKey(newCryptoKey, plaintext);
    if (dryRun) {
      console.log(`  would rotate ${row.id} (${plaintext.length} chars)`);
      migrated++;
      continue;
    }

    // Optimistic-concurrency UPDATE: only succeeds if the row's message is
    // still the original ciphertext we read. Loses the race to a concurrent
    // PATCH from the Worker, which is the correct outcome (the user's most
    // recent edit wins; we report the conflict and let the next script run
    // pick up the now-NEW-encrypted row as a no-op skip).
    const updateResult = d1(
      `UPDATE notifications SET message = '${sqlEscape(reEncrypted)}' ` +
      `WHERE id = '${sqlEscape(row.id)}' AND message = '${sqlEscape(row.message)}'`,
    ) as Array<{ meta?: { changes?: number } }>;
    const changes = updateResult[0]?.meta?.changes ?? 0;
    if (changes === 0) {
      console.warn(`  CONFLICT ${row.id}: row was modified mid-rotation; skipped (re-run picks it up)`);
      conflicts.push(row.id);
      continue;
    }
    console.log(`  rotated ${row.id}`);
    migrated++;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL ${row.id}: ${reason}`);
    failures.push({ id: row.id, reason });
  }
}

console.log(
  `\nsummary: ${migrated} ${dryRun ? "would-rotate" : "rotated"}, ${alreadyNew} skipped (already new), ${conflicts.length} conflicts, ${failures.length} failed`,
);
if (failures.length > 0) {
  console.log("\nfailed rows:");
  for (const f of failures) console.log(`  ${f.id}: ${f.reason}`);
  process.exit(1);
}
if (conflicts.length > 0) {
  console.log("\nconflicts (re-run the script to pick these up):");
  for (const id of conflicts) console.log(`  ${id}`);
  process.exit(2);
}
