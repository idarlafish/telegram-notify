# Security policy

## Supported versions

Only `main` is supported. There are no tagged releases.

## Reporting a vulnerability

Email **idar.dev@pm.me** with subject `[telegram-notify security]` — please **do not** open a public issue for security reports.

Include:

- a description of the issue and its impact
- reproduction steps or a proof-of-concept
- the commit hash you tested against

You can expect an acknowledgement within 72 hours and a fix or mitigation plan within 7 days for confirmed issues.

## Sensitive data in this project

- **Reminder content** is encrypted at rest (AES-256-GCM, per-record IV) using `MESSAGE_KEY`. The Worker decrypts only at send time. A `MESSAGE_KEY` leak means an attacker with database read access can read all stored reminders.
- **`WEBHOOK_SECRET`** authenticates incoming Telegram webhooks. A leak lets anyone forge updates to the bot.
- **`BOT_TOKEN`** authenticates outgoing Telegram API calls. A leak lets anyone send messages as the bot.

All three should be rotated on suspicion of compromise. See `docs/telegram-bot.md` for the webhook-secret rotation procedure.
