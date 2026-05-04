# Storage

Per-user Durable Object SQLite. One `UserSchedulerDO` instance per Telegram
user, addressed deterministically via
`env.USER_SCHEDULER.idFromName('user:${telegramUserId}')`. The DO IS the user
record — no separate users table, no D1.

## Layout per DO

```
UserSchedulerDO  (one per Telegram user)
├── KV-style storage (DurableObjectStorage):
│   └── "profile" → { chat_id: number, created_at: number }
├── SQLite (drizzle-orm/durable-sqlite):
│   └── notifications table (this user's reminders only — no user_id column)
└── Single alarm slot (ctx.storage.{set,get,delete}Alarm)
    Always set to MIN(next_fire_at) over the notifications table, or unset
    when the table is empty.
```

`profile` is null until `/start` calls `bind(chat_id)`. The Mini App auth
middleware uses `profile() === null` as the "send /start to the bot first"
signal.

## `notifications` table

Schema lives in `src/scheduler/user-do/schema.ts`.

```ts
id           text primary key            // crypto.randomUUID() at insert time
message      text not null               // AES-256-GCM ciphertext (see docs/encryption.md)
time         text not null               // "HH:MM" in user's tz
timezone     text not null               // IANA tz, e.g. "Asia/Nicosia"
kind         text not null               // 'one_time' | 'recurring'
weekdays     integer                     // bitmask Mon=1..Sun=64; non-null when recurring
next_fire_at integer not null            // UTC ms — when this row next fires
last_sent_at integer                     // UTC ms — set on each recurring fire
created_at   integer not null default (now)
```

CHECK constraint enforces the kind/weekdays correlation:

```sql
CHECK (
  (kind='recurring' AND weekdays BETWEEN 1 AND 127)
  OR (kind='one_time' AND weekdays IS NULL)
)
```

Index on `next_fire_at` exists for the alarm-time scan and the `MIN()`
recompute after every mutation.

## `next_fire_at` semantics

`next_fire_at` always means "the next UTC ms at which this row should fire."
The alarm handler queries:

```sql
WHERE next_fire_at <= now AND next_fire_at > now - 5min
```

The 5-minute lookback catches anything missed during DO eviction or transient
errors. After a successful send, the kinds diverge:

- `recurring` → `next_fire_at` advances via `nextRecurring(time, tz, weekdays, sentAtMs)`
- `one_time` → row is deleted

Then `refreshAlarm()` recomputes `MIN(next_fire_at)` over the remaining rows
and either `setAlarm(min)` or `deleteAlarm()` if empty.

## Why no `user_id` column

Each DO instance owns exactly one user's notifications. Adding a `user_id`
would be redundant — the DO ID *is* the user identity. This is the architectural
shift from the previous D1 design.

## Why no `date` column for one-time

Date is fully derivable from `format(next_fire_at, timezone)` — storing it
would create a third source of truth. Wire format (POST/PATCH body) accepts
`date` as user input; the server computes `next_fire_at` from
`(date, time, timezone)` and stores only `next_fire_at`.

## `weekdays` is a storage detail

The bitmask never appears in the API or the frontend. The wire format speaks
`days: WeekDay[]` (`'mon'..'sun'`). Conversion lives in
`src/scheduler/user-do/mappers.ts` (`daysToBitmask` / `bitmaskToDays`),
called inside the DO's `create` / `update` / `toApi` paths.

## Migrations — drizzle-kit owns them

Workflow when you change `schema.ts`:

```bash
# 1. Edit src/scheduler/user-do/schema.ts
# 2. Generate the migration SQL + meta snapshot
bunx drizzle-kit generate

# 3. Commit the new SQL file + meta snapshot
git add drizzle/migrations/
```

`drizzle.config.ts` uses `driver: "durable-sqlite"`, so generated migrations
target the DO's SQLite engine. The DO constructor calls
`migrate(this.db, migrations)` inside `ctx.blockConcurrencyWhile()` on every
cold start — pending migrations apply per-DO at next wake. There is no global
"apply migrations" step; each user's DO migrates independently when next
touched.

The auto-emitted `drizzle/migrations/migrations.js` (drizzle-kit's bundler
entry that re-exports the migrations array) is imported by the DO via a
sibling `migrations.d.ts` shim. Don't hand-edit either of those.

## Backups

DO storage is durable per-namespace and replicated by Cloudflare. There is no
per-DO backup primitive equivalent to D1 Time Travel; the operational story
for restore-from-disaster is "recover from the source of truth," which is
Telegram itself (message history). For high-value future use cases, consider
periodic export of all DOs to R2.

## Removed

The previous D1 + `users` + cron-driven design has been migrated out (see
the per-user DO migration spec for the reasoning). What was D1 +
cron-every-minute is now per-user DO + alarm-on-MIN-next-fire-at. Cron lag
(70–90s at top-of-hour, observed in production analytics for May 1–4 2026)
is replaced by sub-second DO alarm precision.
