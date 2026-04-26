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

const newCryptoKey = await importKeyFromBase64(newKey);
const oldCryptoKey = await importKeyFromBase64(oldKey);

async function decryptWithFallback(b64: string): Promise<{ plaintext: string; wasNew: boolean }> {
  try {
    return { plaintext: await decryptWithKey(newCryptoKey, b64), wasNew: true };
  } catch {
    return { plaintext: await decryptWithKey(oldCryptoKey, b64), wasNew: false };
  }
}

function d1(cmd: string): unknown {
  const r = spawnSync("bunx", [
    "wrangler", "d1", "execute", "telegram-notify-db",
    "--remote", "--json", "--command", cmd,
  ], { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    throw new Error(`wrangler d1 execute failed: ${r.stderr.toString()}`);
  }
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
    } else {
      d1(`UPDATE notifications SET message = '${sqlEscape(reEncrypted)}' WHERE id = '${sqlEscape(row.id)}'`);
      console.log(`  rotated ${row.id}`);
    }
    migrated++;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL ${row.id}: ${reason}`);
    failures.push({ id: row.id, reason });
  }
}

console.log(`\nsummary: ${migrated} ${dryRun ? "would-rotate" : "rotated"}, ${alreadyNew} skipped (already new), ${failures.length} failed`);
if (failures.length > 0) {
  console.log("\nfailed rows:");
  for (const f of failures) console.log(`  ${f.id}: ${f.reason}`);
  process.exit(1);
}
