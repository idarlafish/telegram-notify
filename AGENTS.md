# Agent guide — telegram-notify

You're working on a Telegram reminder bot deployed as a single Cloudflare
Worker that serves both a Hono API and a React Mini App.

## At a glance

- **One Worker, one deploy.** `src/` = Hono backend (API + bot webhook + cron).
  `web/` = React 19 + Vite Mini App, served via Cloudflare Workers Static
  Assets from the same Worker.
- **Stack.** TypeScript everywhere. Hono, drizzle-orm + drizzle-kit (D1),
  Workers KV (cron heartbeat), valibot, vitest, grammY. Frontend: TanStack
  Router/Query/Form, valibot.
- **Single bot, single env.** Production `@sleepy_notify_bot`. No staging
  Worker. Secrets in `.env` (gitignored) AND in `wrangler secret`; keep them
  in sync.

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
- **Migrations are owned by drizzle-kit.** Edit `src/db/schema.ts`, run
  `bunx drizzle-kit generate`, commit the new SQL + meta snapshot.

## Where to look

```bash
# Discover topical docs as you need them
find docs/ -name '*.md' | sort
```

Read the topic file that matches your task — don't pre-load everything.

| When working on… | Read |
|---|---|
| Schema / queries / migrations | `docs/database.md` |
| Encryption / privacy posture | `docs/encryption.md` |
| Telegram bot config (webhook, menu button, BotFather) | `docs/telegram-bot.md` |
| Local dev workflow + tunneling for Mini App | `docs/development.md` |
| Deployment + cutover procedures | `docs/deploy.md` |
| Frontend architecture (router/query/form) | `docs/frontend.md` |

## Working commands

```bash
bun run dev            # wrangler dev (Worker)
bun run dev:web        # vite dev (Mini App on :5173, proxies API to :8787)
bun run typecheck      # backend + web
bun run test           # backend vitest
bun run test:web       # frontend vitest
bun run deploy         # vite build → wrangler deploy (atomic)

bun run db:migrate:local     # apply migrations to local D1
bun run db:migrate:remote    # apply to remote D1
bun run bot:set-commands     # register slash commands shown in Telegram
bun run set-webhook          # (re)register the bot webhook URL

bun run scripts/rotate-message-key.ts --dry-run   # NEW_KEY=... OLD_KEY=... env required; see docs/encryption.md
```

## Commits

Conventional Commits style (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
Keep bodies proportional to the change — don't pad small commits with
rationale paragraphs. Never add `Co-Authored-By` lines.
