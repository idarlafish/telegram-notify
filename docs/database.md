# Database

D1 (SQLite-on-edge), accessed through drizzle-orm. Two tables: `users` and
`notifications`. Schema lives in `src/db/schema.ts` and is the source of
truth — migrations are generated from it, not hand-written.

## Tables

**`users`** — minimal. Telegram user id is the primary key (also used as
`chat_id` in the common case of private chats; we keep them as separate
columns to support group-chat scenarios that aren't currently exposed in the
Mini App but cost nothing to store).

**`notifications`** — every reminder row.

```ts
id           text primary key            // crypto.randomUUID() at insert time
user_id      integer not null            // FK to users.id, ON DELETE CASCADE
message      text not null               // AES-256-GCM ciphertext (see docs/encryption.md)
time         text not null               // "HH:MM" in user's tz
timezone     text not null               // IANA tz, e.g. "Asia/Nicosia"
kind         text not null               // 'one_time' | 'recurring'
weekdays     integer                     // bitmask Mon=1..Sun=64; non-null when recurring
next_fire_at integer not null            // UTC ms — when this row next fires
last_sent_at integer                     // UTC ms — set by recordSent after a recurring fire
created_at   integer not null default (now)
```

### Hard invariants enforced at the storage layer

```sql
CHECK (
  (kind='recurring' AND weekdays BETWEEN 1 AND 127)
  OR (kind='one_time' AND weekdays IS NULL)
)
```

The CHECK is the single most important schema element — it makes the kind /
weekdays correlation impossible to violate even from a buggy code path. Any
INSERT or UPDATE that would create an inconsistent row fails at the database.

### `next_fire_at` semantics — same for both kinds

`next_fire_at` always means "the next UTC ms at which this row should fire."
The cron query treats both kinds identically:

```sql
WHERE next_fire_at <= now AND next_fire_at > now - 5min
```

The kinds diverge **only after** a successful send, in `src/scheduler/tick.ts`:

- `kind = 'recurring'` → `recordSent` advances `next_fire_at` to the next
  matching weekday at the configured `time` in `timezone`.
- `kind = 'one_time'` → `deleteById` removes the row entirely. There's no
  archived/completed state; one-time = consumed.

### Why no `date` column for one-time

Date is fully derivable from `format(next_fire_at, timezone)` — storing it
would create a third source of truth that could drift from the other two.
Frontend-side `apiRowToForm` does the derivation when prefilling the edit
form. Wire format (POST/PATCH body) accepts a `date` field as user input;
the server computes `next_fire_at` from `(date, time, timezone)` and stores
only `next_fire_at`.

### `weekdays` is a storage detail

The bitmask never appears in the API or the frontend. The wire format speaks
`days: WeekDay[]` (`'mon'..'sun'`). Conversion lives in `src/db/mappers.ts`
(`daysToBitmask` / `bitmaskToDays`), called at the API edge. Keep it that way
— pushing the bitmask into the API or UI for "performance" reasons is a code
smell at this scale (D1 can handle JSON arrays just fine; the bitmask is
purely about clean SQL constraints).

## Migrations — drizzle-kit owns them

Workflow when you change `schema.ts`:

```bash
# 1. Edit src/db/schema.ts
# 2. Generate the migration SQL + meta snapshot
bunx drizzle-kit generate

# 3. Apply locally + remotely
bun run db:migrate:local
bun run db:migrate:remote

# 4. Commit BOTH the new SQL file AND migrations/meta/_journal.json + the
#    new snapshot file. Without the meta snapshot, future drizzle-kit
#    generate will produce broken diffs.
git add migrations/
```

Never write SQL files in `migrations/` by hand. drizzle-kit is the ONLY
writer of that directory.

### Wipe-and-reseed philosophy

This project has one user. Every schema change so far has been "wipe + reseed"
— the migrations directory does not contain any data-preserving backfill
code, and we're free to break things forward. If/when the user count grows
beyond two or three, this stops being safe and the migration story has to
shift to genuine forward-compatible changes. For now, prefer:

```bash
bunx wrangler d1 execute telegram-notify-db --remote --command="DELETE FROM notifications;"
# ...modify schema, generate, apply
```

over writing UPDATE backfills that you'll only run once.

### The CHECK constraint and ALTER TABLE

SQLite cannot `ALTER TABLE ADD CHECK`. drizzle-kit handles this by emitting
the standard SQLite "create new table, copy data, drop old, rename" pattern.
For an empty `notifications` table this is a no-op; for a populated one it
reads + re-inserts every row. At our row counts (single digits) it doesn't
matter, but it's worth knowing if you ever wonder why the migration SQL
looks complicated for a "just add a column" change.

## Backups

D1 Time Travel (built-in, free, 30-day window) is the primary backup. See
the README's "Operational notes" section for the commands. For one-shot
exports before risky changes:

```bash
bunx wrangler d1 export telegram-notify-db --remote --output=backup-$(date +%F).sql
```
