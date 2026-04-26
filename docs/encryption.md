# Encryption

Reminder `message` fields are encrypted at the application layer with
AES-256-GCM before being stored in D1. Implementation in `src/lib/crypto.ts`.

## Threat model — what this protects against

- D1 export ending up in the wrong place (chat paste, lost laptop, accidental
  S3 dump).
- An operator running `wrangler d1 execute "SELECT * FROM notifications"` and
  reading user content over their shoulder.
- A future hypothetical Cloudflare-side leak limited to D1 storage.
- The general "we should have encryption" GDPR Article 32 box.

## What this does NOT protect against

- **Anyone who can deploy to the Worker.** The Worker holds `MESSAGE_KEY`;
  any code path executing inside it can decrypt. Reading user data becomes a
  deliberate act (writing a script that loads the secret), but it's not
  blocked.
- **A compromise of the Cloudflare account.** Same reason — secrets are
  readable by anyone with deploy access.
- **True end-to-end encryption.** Impossible by design: when the cron tick
  fires, the Worker has to call `bot.api.sendMessage(chat_id, plaintext)`.
  If the Worker can't decrypt the message, it can't deliver it. Any
  "client-only key" architecture would break the bot's core function.

The bar this clears is **"the operator can't read user data without
intentionally setting out to."** Casual access shows base64 ciphertext.

## Storage format

Each encrypted message is base64 of `IV (12 bytes) || ciphertext+auth-tag`.
Reused IVs would catastrophically break GCM, so a fresh `crypto.getRandomValues(12)`
is generated per write. The format is self-describing — no separate IV column,
no schema overhead.

```
[ 12 bytes IV ][ N bytes ciphertext ][ 16 bytes GCM auth tag ]
└────────────── base64-encoded into the `message` TEXT column ──────────────┘
```

## Key shape

`MESSAGE_KEY` is a base64-encoded 32-byte AES-256 key, stored as a Worker
secret. Generation:

```bash
openssl rand -base64 32
```

The same value lives in `.env` (gitignored) for local dev / migration scripts
and as a Cloudflare secret for the deployed Worker. Both must agree — the
[webhook secret pitfall](./telegram-bot.md#the-webhook-secret-pitfall-read-this-first)
explains the failure mode when local-and-Worker-side secrets drift.

## Read path is strict

`safeDecryptMessage` (the migration-window helper that returned plaintext on
decrypt failure) was removed once the legacy plaintext rows were gone. The
codebase now uses `decryptMessage` directly, which throws on any decrypt
failure. This is intentional: a decrypt failure now is a real bug or a real
key mismatch, not "an old row pre-encryption" — and we want it to surface as
a 500 + log line, not silently return ciphertext to the user.

If you ever need to migrate again (key rotation, new fields), reintroduce
`safeDecryptMessage` temporarily, run the migration, then remove it.

## Key rotation

Currently undocumented as a procedure; the script doesn't exist yet. The
shape of a future `scripts/rotate-message-key.ts`:

1. Set both `OLD_MESSAGE_KEY` and `NEW_MESSAGE_KEY` as Worker secrets.
2. Deploy a transitional version that writes with NEW and tries decrypt with
   NEW first, falls back to OLD (a parameterized `safeDecryptMessage`).
3. Run the rotation script: read every row, decrypt with OLD, re-encrypt with
   NEW, atomic UPDATE. Idempotent (already-NEW rows decrypt cleanly with
   NEW and are skipped).
4. Remove `OLD_MESSAGE_KEY` from secrets, deploy the strict-decrypt version
   that only knows NEW.

Until the script exists, key rotation is a manual debugging session. See
TODO.md.

## What's NOT encrypted

`time`, `timezone`, `weekdays`, `next_fire_at`, `last_sent_at`, `kind` are
all plaintext. They have no PII content (a user's reminder firing at 09:00
on weekdays in Asia/Nicosia is not sensitive on its own), and encrypting
them would break the index on `next_fire_at` that makes the cron query O(log
N) instead of full-table scan.

If you ever decide reminder *schedules* are also sensitive, the right answer
is per-user encryption with the cron query rewritten around a user-scoped
shard, not encrypting the index column. That's a much larger architectural
change than encrypting `message` was.

## Audit checklist

When changing anything in `src/lib/crypto.ts` or its callers:

- [ ] `crypto.getRandomValues(new Uint8Array(12))` runs **per encrypt call**
      — never reuse an IV across two records under the same key.
- [ ] `decryptMessage` throws on failure (no try/catch swallowing in the
      hot path other than at the API error middleware).
- [ ] `MESSAGE_KEY` length validated at import (32 bytes raw / 44 chars base64).
- [ ] No log line contains `env.MESSAGE_KEY`, `process.env.MESSAGE_KEY`, or a
      decrypted `message` field.
