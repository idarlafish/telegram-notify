# telegram-notify

Telegram reminder bot — daily / weekday-set / one-time notifications.

A single Cloudflare Worker serves the API (Hono), the bot webhook (grammY),
the cron scheduler, and the React Mini App (Cloudflare Workers Static Assets).
Storage is Cloudflare D1 with drizzle-orm; messages are encrypted at the
application layer (AES-256-GCM).

> Replaced the legacy redis/bullmq/k8s `sleepy-notify` deployment.

## Stack

| | |
|---|---|
| Runtime | Cloudflare Workers (single deploy) |
| Storage | Cloudflare D1 (drizzle-orm + drizzle-kit) |
| Backend | Hono, valibot, grammY, vitest |
| Frontend | React 19, Vite, TanStack Router/Query/Form, valibot |
| Encryption | AES-256-GCM (Web Crypto), per-record IV |

## Layout

```
src/                    Worker — API, bot, cron, db, crypto
  api/                  Hono routes + middleware
  db/                   drizzle schema + queries + mappers
  telegram/             grammY webhook + commands
  scheduler/            cron tick handler
  lib/                  time math, crypto, logger, errors
web/                    React Mini App (Bun workspace)
  src/
    routes/             ListPage, FormPage, PrivacyPage
    components/         per-component folders
    api/                fetch client + TanStack Query hooks + form↔API mappers
    lib/                Telegram SDK hooks, form schema, time helpers
    styles/             shared CSS modules
migrations/             drizzle-kit generated SQL + meta snapshots
scripts/                bot config (set-webhook, set-commands, check-bot-config)
docs/                   topical guides — see AGENTS.md
```

## Setup

```bash
bun install

# D1
bunx wrangler d1 create telegram-notify-db   # paste id into wrangler.toml
bun run db:migrate:remote
bun run db:migrate:local

# Secrets — both .env (local) and Worker secrets must agree
cp .dev.vars.example .env
# edit .env to fill BOT_TOKEN, WEBHOOK_SECRET, MESSAGE_KEY (32-byte base64)
bunx wrangler secret put BOT_TOKEN
bunx wrangler secret put WEBHOOK_SECRET
bunx wrangler secret put MESSAGE_KEY

# Generate a fresh MESSAGE_KEY:  openssl rand -base64 32

# Deploy + register the bot webhook
bun run deploy
bun run set-webhook         # reads BOT_TOKEN, WEBHOOK_SECRET, WEBHOOK_URL from env
bun run bot:set-commands    # registers /start and /stop in Telegram's slash menu
```

## Local dev

```bash
bun run dev:web    # Vite on :5173 (React HMR)
bun run dev        # wrangler dev on :8787 (D1, secrets, scheduled handler)
```

Vite proxies `/api`, `/telegram-webhook`, and `/health` to wrangler.
For real Telegram testing, expose Vite via a Cloudflare Tunnel and register
the tunnel URL on a *dev* bot (don't repoint the prod webhook).

Cron doesn't fire in local dev by default — trigger manually with
`bunx wrangler dev --test-scheduled` then `curl http://localhost:8787/__scheduled?cron=*+*+*+*+*`.

## API

All requests authenticate via `Authorization: tma <initData>` header.
Wire format speaks `days: WeekDay[]`; bitmasks live only in the database.

| Method | Path | Body | Response |
|---|---|---|---|
| GET    | `/api/notifications` | — | `{ items: Notification[] }` |
| POST   | `/api/notifications` | `{ kind, time, timezone, message, days?, date? }` (variant on `kind`) | `{ notification }` (201) |
| PATCH  | `/api/notifications/:id` | partial of POST body | `{ notification }` |
| DELETE | `/api/notifications/:id` | — | `{ ok: true }` |
| GET    | `/health` | — | `{ status: "ok" }` |
| POST   | `/telegram-webhook` | Telegram update (validated by `x-telegram-bot-api-secret-token`) | grammY response |

## Bot commands

| Command | Effect |
|---|---|
| `/start` | Register your account; clear stale per-chat menu overrides; remove old reply keyboards. |
| `/stop` | Erase your user record and all reminders (CASCADE delete via FK). |

## Operational notes

- **Atomic deploy** — `bun run deploy` builds the React app and ships it
  with the Worker in one transaction. Cron may miss one minute during the
  switch; the 5-minute lookback in `findDueNotifications` recovers it.
- **Encryption** — `message` field is encrypted with `MESSAGE_KEY` before
  insert; reads decrypt strictly (no plaintext fallback). Rotation requires a
  re-encrypt migration script.
- **Backups** — D1 Time Travel covers the last 30 days for free
  (`wrangler d1 time-travel restore telegram-notify-db --timestamp …`). Run
  `wrangler d1 export` before any risky migration.
- **Privacy policy** — served at `/privacy` (React route). URL is registered
  in BotFather under Bot Settings → Privacy Policy.
- **DST** — recurrence times shift ±1h around DST transitions twice a year.
  `Intl.DateTimeFormat` handles tz math correctly; the user's `time` string
  stays anchored to local clock.

## Further reading

- `AGENTS.md` — entry point for AI agents (Cursor, Aider, Codex, Claude Code, …).
- `docs/telegram-bot.md` — bot config, webhook secret pitfall, menu button hierarchy.
- More topical docs land in `docs/` as needed; see `AGENTS.md` for the index.
