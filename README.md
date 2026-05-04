<div align="center">

# telegram-notify

Telegram reminder bot with a Telegram Mini App.

[![CI](https://github.com/idarlafish/telegram-notify/actions/workflows/ci.yml/badge.svg)](https://github.com/idarlafish/telegram-notify/actions/workflows/ci.yml)
![License](https://img.shields.io/github/license/idarlafish/telegram-notify)
![Runtime](https://img.shields.io/badge/runtime-Cloudflare%20Workers-f38020)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6)

</div>

## Overview

A self-hosted reminder bot for Telegram, deployed as a single Cloudflare Worker.

**What it does:**

- recurring reminders (daily or custom weekday sets)
- one-time reminders
- a Telegram Mini App for managing them visually
- AES-256-GCM encryption of reminder content at rest

**Why this stack:**

- **Telegram's Bot API has no scheduled messages** — the original constraint that made this project necessary. Any reminder bot has to run its own scheduler.
- **Sub-second precision** — alarms fire from per-user Durable Objects, not a 30–90s polling cron
- **Zero external dependencies** — Cloudflare Workers + Durable Objects + Telegram are the entire runtime. No Redis, no queue, no third-party scheduler
- **Single atomic deploy** — backend, frontend (Mini App), and storage migrations ship together
- **Fork-friendly** — designed to run on your own Cloudflare account and your own bot

## Architecture

### Components

```mermaid
graph LR
  user[Telegram user]

  subgraph cf[Cloudflare Worker — telegram-notify.la.fish]
    api[Hono API<br/>/api/notifications<br/>/api/users]
    webhook[Bot webhook<br/>/telegram-webhook]
    assets[Mini App static assets<br/>React + Vite]
    services[/services<br/>user.ts · notifications.ts/]
    do[(UserSchedulerDO<br/>per user · SQLite + 1 alarm)]
  end

  user -->|opens Mini App| assets
  user -->|/start, /stop| webhook
  assets -->|fetch /api/...| api
  api -->|function call| services
  webhook -->|function call| services
  services -->|RPC| do
  do -.->|alarm fires<br/>bot.api.sendMessage| user
```

### Lifecycle of a reminder

```mermaid
sequenceDiagram
  participant U as User (Telegram)
  participant W as Webhook
  participant A as Mini App API
  participant S as services/*
  participant DO as UserSchedulerDO
  participant T as Telegram API

  U->>W: /start in DM (chat_id=12345)
  W->>S: bindUser(12345, 12345)
  S->>DO: bind(12345)
  Note over DO: profile = { chat_id: 12345, created_at: now }

  U->>A: open Mini App, POST /api/notifications<br/>{kind:"recurring", time:"10:00", days:["mon".."fri"]}
  A->>S: createNotification(input)
  S->>DO: create(input)
  Note over DO: encrypt(message)<br/>INSERT row<br/>setAlarm(next 10:00)

  Note over DO: ...time passes...
  Note over DO: alarm fires at 10:00:00.04 (sub-second)
  DO->>T: sendMessage(chat_id, decrypt(message))
  T-->>DO: ok
  Note over DO: UPDATE next_fire_at = next 10:00<br/>setAlarm(next earliest)
  T->>U: reminder appears in chat
```

## Stack

| Layer      | Stack                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)                                                                                                       |
| Storage    | ![Durable Objects](https://img.shields.io/badge/Durable_Objects-F38020?logo=cloudflare&logoColor=white) ![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)                                                                                                                      |
| Backend    | ![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white) ![valibot](https://img.shields.io/badge/valibot-3178C6) ![grammY](https://img.shields.io/badge/grammY-1F8DD6) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)                                       |
| Frontend   | ![React 19](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) ![TanStack](https://img.shields.io/badge/TanStack-FF4154?logo=tanstack&logoColor=white) ![valibot](https://img.shields.io/badge/valibot-3178C6) |
| Encryption | ![AES-256-GCM](https://img.shields.io/badge/AES--256--GCM-000000) ![Web Crypto](https://img.shields.io/badge/Web_Crypto-FFB300?logoColor=white)                                                                                                                                                                   |

## Setup

```bash
bun install

cp .env.example .env
# fill in BOT_TOKEN, WEBHOOK_SECRET, MESSAGE_KEY, CLOUDFLARE_ACCOUNT_ID,
# WEBHOOK_URL, VITE_PRIVACY_CONTACT_EMAIL — see .env.example for each.

bunx wrangler login
bunx wrangler secret put BOT_TOKEN
bunx wrangler secret put WEBHOOK_SECRET
bunx wrangler secret put MESSAGE_KEY

bun run deploy
bun run set-webhook
```

Generate a fresh `MESSAGE_KEY` with `openssl rand -base64 32`.

For staging, fill the `STAGING_BOT_TOKEN` / `STAGING_WEBHOOK_SECRET` / `STAGING_MESSAGE_KEY` / `STAGING_WEBHOOK_URL` block in `.env`, push them with `--env staging`, then `bun run deploy:staging` and `bun run set-webhook:staging`.

## Local development

```bash
bun run dev:web    # Vite on :5173 (React HMR)
bun run dev        # wrangler dev on :8787 (DO + secrets)
```

Useful checks:

```bash
bun run typecheck
bun run test
bun run test:web
```

## API

| Method | Path                     | Body                                                                  | Response                               |
| ------ | ------------------------ | --------------------------------------------------------------------- | -------------------------------------- |
| GET    | `/api/notifications`     | —                                                                     | `{ items: Notification[] }`            |
| POST   | `/api/notifications`     | `{ kind, time, timezone, message, days?, date? }` (variant by `kind`) | `{ notification }`                     |
| PATCH  | `/api/notifications/:id` | partial of POST body                                                  | `{ notification }`                     |
| DELETE | `/api/notifications/:id` | —                                                                     | `{ ok: true }`                         |
| GET    | `/api/users/me`          | —                                                                     | `{ profile: { chat_id, created_at } }` |
| DELETE | `/api/users/me`          | — (destroys all your data)                                            | `{ ok: true }`                         |
| GET    | `/health`                | —                                                                     | `{ status: "ok" }`                     |
| POST   | `/telegram-webhook`      | Telegram update (validated by `x-telegram-bot-api-secret-token`)      | grammY response                        |

## Bot commands

| Command  | Effect                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| `/start` | Bind your `chat_id` to your `UserSchedulerDO` profile (idempotent).          |
| `/stop`  | `userDO.destroy()` — clears profile, deletes all rows, and unsets the alarm. |
