# telegram-notify

Daily Telegram reminders. Cloudflare Workers + D1 + Cron Triggers, free tier.

Replaces the redis/bullmq/k8s-deployed `sleepy-notify` with edge-hosted infra.

## Architecture

- **Worker** (`src/index.ts`): single fetch handler routes Telegram webhooks (`/telegram-webhook`), Mini App API (`/api/*`), and a `/health` endpoint. `scheduled` handler runs every minute.
- **D1** database holds users + notifications. Indexed on `next_fire_at` so the per-minute cron query is O(log N).
- **Cron Trigger** (`* * * * *`) calls the scheduled handler → `findDueNotifications` → send via grammY → `recordSent` advances `next_fire_at` to tomorrow.
- **Auth**: Mini App requests carry `Authorization: tma <initData>`; verified via HMAC-SHA256 against `BOT_TOKEN` per Telegram's spec.

## First-time setup

```bash
bun install

# Create the D1 database; copy the returned database_id into wrangler.toml.
bunx wrangler d1 create telegram-notify-db

# Apply schema locally (dev) and remotely (prod).
bun run db:migrate:local
bun run db:migrate:remote

# Set bot token + webhook secret as Worker secrets.
bunx wrangler secret put BOT_TOKEN
bunx wrangler secret put WEBHOOK_SECRET

# Deploy.
bun run deploy

# Register the webhook with Telegram (one-off).
BOT_TOKEN=... WEBHOOK_URL=https://<worker>.workers.dev/telegram-webhook \
  WEBHOOK_SECRET=... bun run set-webhook
```

## Local dev

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars with bot token + secret
bun run dev
```

`wrangler dev` runs the Worker locally with a local D1 sqlite file (`.wrangler/state/v3/d1`). Cron triggers don't fire automatically in local dev — invoke manually with `bunx wrangler dev --test-scheduled` and hit `/__scheduled?cron=*+*+*+*+*`.

## API

All requests need `Authorization: tma <initData>` header.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/notifications` | — | `{ items: Notification[] }` |
| POST | `/api/notifications` | `{ time, timezone, message }` | `{ notification }` (201) |
| DELETE | `/api/notifications/:id` | — | `{ ok: true }` |

## Frontend

Not in this repo (yet). The existing `sleepy-notify` SvelteKit Mini App can be ported to point at this Worker's API. Plan: deploy frontend to Cloudflare Pages (free), point at this Worker.

## Operational notes

- Cron is best-effort. The `findDueNotifications` query uses a 5-minute lookback so a missed cron firing is recovered on the next one.
- DST: notifications shift ±1h twice a year as `Intl.DateTimeFormat` recomputes the local clock. Re-tune around the change if it matters.
- All operational state is in D1. No persistent infra to manage.
