# Agent guide — telegram-notify

You're working on a Telegram reminder bot deployed as a single Cloudflare
Worker that serves both a Hono API and a React Mini App.

## At a glance

- **One Worker, one deploy.** `src/` = Hono backend (API + bot webhook).
  `web/` = React 19 + Vite Mini App, served via Cloudflare Workers Static
  Assets from the same Worker. Reminder firing is owned by `UserSchedulerDO`
  (one Durable Object per Telegram user).
- **Stack.** TypeScript everywhere. Hono, drizzle-orm/durable-sqlite +
  drizzle-kit (per-user DO SQLite), valibot, vitest +
  @cloudflare/vitest-pool-workers, grammY. Frontend: TanStack
  Router/Query/Form, valibot.
- **Two envs.** Production `@sleepy_notify_bot` at `telegram-notify.la.fish`
  and staging at `telegram-notify-staging.la.fish` (separate bot, separate
  DO namespace). Use `--env staging` for any wrangler/script command
  targeting staging. Secrets in `.env` (gitignored) AND in `wrangler secret`;
  keep them in sync. Staging keys (`STAGING_MESSAGE_KEY`,
  `STAGING_WEBHOOK_SECRET`, `STAGING_BOT_TOKEN`) are distinct from prod values.

## Hard rules

- **Don't commit anything under `docs/superpowers/` or `.superpowers/`.**
  These are local working drafts (specs, plans, brainstorm artifacts) — they
  belong on disk for review, not in git.
- **Never narrate intent without the tool call in the same turn.** If you say
  "writing the file now", the Write call is in the same response — not the
  next one.
- **Don't add backwards-compat code or legacy shims unless explicitly asked.**
  This project has one user; it's safe to break things and migrate forward.
- **Frontend and backend validation are separate.** `web/src/lib/form-schema.ts`
  validates UI fields; `src/api/schemas.ts` validates wire payloads. They're
  shaped differently on purpose — don't unify them.
- **Bitmasks live only in the database.** The API speaks `days: WeekDay[]`;
  the frontend never sees integer bitmasks.
- **DO storage is per-user.** The `UserSchedulerDO` class (one instance per
  Telegram user, addressed via `idFromName('user:${telegramUserId}')`) owns
  its user's notifications in DO SQLite + a single alarm slot pointing at
  `MIN(next_fire_at)`. Schema lives in `src/scheduler/user-do/schema.ts`.
  Edit it, then `bunx drizzle-kit generate` to emit a new migration into
  `drizzle/migrations/`. Commit the new `*.sql` + meta snapshot. The `migrate()`
  call in the DO constructor applies pending migrations at next cold start
  per-DO.

## Where to look

```bash
# Discover topical docs as you need them
find docs/ -name '*.md' | sort
```

Read the topic file that matches your task — don't pre-load everything.

| When working on…                                      | Read                   |
| ----------------------------------------------------- | ---------------------- |
| Per-user DO storage / migrations                      | `docs/database.md`     |
| Encryption / privacy posture                          | `docs/encryption.md`   |
| Telegram bot config (webhook, menu button, BotFather) | `docs/telegram-bot.md` |

## Working commands

```bash
bun run dev                  # wrangler dev (Worker)
bun run dev:web              # vite dev (Mini App on :5173, proxies API to :8787)
bun run typecheck            # backend + web
bun run test                 # backend vitest (unit + workers pool)
bun run test:web             # frontend vitest
bun run deploy               # vite build → wrangler deploy (atomic, prod)

bun run dev:staging          # wrangler dev against staging env
bun run deploy:staging       # vite build → wrangler deploy (staging)
bun run set-webhook[:staging]  # one-shot: register webhook URL with Telegram

bunx drizzle-kit generate    # regenerate DO migrations after editing schema
```

## Commits

Conventional Commits style (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
Keep bodies proportional to the change — don't pad small commits with
rationale paragraphs. Never add `Co-Authored-By` lines.
