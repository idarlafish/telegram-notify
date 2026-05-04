# Telegram bot operations

The Worker serves a single bot, **`@sleepy_notify_bot`**. `BOT_TOKEN` lives in `.env` AND on the Worker as the `BOT_TOKEN` secret — both must match. Same applies to `WEBHOOK_SECRET` and `MESSAGE_KEY`.

## The webhook-secret pitfall (read this first)

When a webhook POST arrives, the Worker validates the
`x-telegram-bot-api-secret-token` header against `env.WEBHOOK_SECRET` and
returns **403 with no log line** on mismatch. Telegram queues updates for
retry, the bot looks dead, and `wrangler tail` shows POSTs returning OK with
no handler activity. **It is the single most-confusing failure mode in this
codebase.**

The drift happens when:

- `wrangler secret put WEBHOOK_SECRET` was run with one value, and
- the `setWebhook` Bot API call registered a different value with Telegram.

**Diagnose:** `wrangler tail` and trigger an action — if you see
`{"level":"warn","message":"webhook secret mismatch","received_len":N,"expected_len":M}`,
the lengths give you the smoking gun. For URL drift, hit the Bot API directly:
`curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"`.

**Fix:** decide which value is canonical (the one in `.env`), then push it to
the Worker:

```bash
set -a && source .env && set +a
printf '%s' "$WEBHOOK_SECRET" | bunx wrangler secret put WEBHOOK_SECRET
```

No need to re-call `setWebhook` if you sync the Worker side; Telegram already
has the right value. Verify by triggering one update and watching tail for
`webhook received` instead of `webhook secret mismatch`.

## The three menu-button-shaped buttons

Users can see up to three different "open the app" entry points on a Telegram
bot, and they're configured in different places:

| Entry point                      | Visible as                                                                     | Where set                                                              | Bot API method                                |
| -------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------- |
| **Per-chat menu button**         | The ≡ icon at bottom-left of chat input, for _one specific user_               | `bot.api.setChatMenuButton({ chat_id, menu_button })`                  | `setChatMenuButton` with `chat_id`            |
| **Bot-wide default menu button** | Same ≡ icon, for _all users_ who don't have a per-chat override                | `bot.api.setChatMenuButton({ menu_button })` (no `chat_id`)            | `setChatMenuButton`                           |
| **Profile-level "Open App"**     | Prominent button on the bot's profile card, also `t.me/<bot>/<app>` deep links | **@BotFather only** — `/myapps` or `Bot Settings → Configure Mini App` | none — read-only via `getMe.has_main_web_app` |

**Per-chat overrides bot-wide.** That's why `src/telegram/commands/start.ts`
explicitly resets the per-chat menu to `default` — the old sleepy-notify
backend installed per-chat overrides pointing at a dev tunnel URL, and they
persisted for every user who had ever sent `/start` to the old bot.

**The profile-level Mini App is BotFather-only.** `getMe.has_main_web_app`
tells you if it exists; nothing in the Bot API can edit or delete it. To
update or remove, go through `@BotFather → /myapps`.

## Stuck UI state in the client

If users report seeing an "old" button after you've cleaned up server-side
config, the order of operations is:

1. Confirm server-side state via the Bot API directly (`getMe.has_main_web_app`,
   `getChatMenuButton` — `curl https://api.telegram.org/bot$BOT_TOKEN/getMe`).
2. If server is clean, the user's client is showing cached data:
   - **Persistent reply keyboards** (the kind `Keyboard.webApp(...)` sends)
     stay attached to the user's chat session until the bot sends
     `reply_markup: { remove_keyboard: true }`. Sending `/start` triggers
     this in our handler.
   - **Inline keyboards on old messages** stay forever; their URLs are baked
     into the message at send time. Only fix is deleting the chat history.
   - **Telegram client cache of bot profile data** can persist for minutes
     after server changes. Force-quit the app + reopen.

## Webhook registration (one-shot)

The webhook URL + secret live on Telegram's side and survive every deploy. Run
this only on first-time setup, when rotating `WEBHOOK_SECRET`, or when the URL
changes:

```bash
bun run set-webhook              # production
bun run set-webhook:staging      # staging
```

The script (`scripts/set-webhook.ts`) reads `BOT_TOKEN`/`WEBHOOK_SECRET` (or
the `STAGING_BOT_TOKEN`/`STAGING_WEBHOOK_SECRET` pair) from `.env` and calls
the Bot API's `setWebhook` once.

## Slash-command menu (auto on cold start)

The `/start` and `/stop` menu is registered by the Worker itself via
`@grammyjs/commands`. Each cold isolate calls `setMyCommands` once on the
first webhook delivery (`src/telegram/commands/index.ts`), then skips it for
the rest of that isolate's lifetime. Telegram is idempotent on the call, so
this is safe — but it does mean the _only_ place command names + descriptions
are defined is in `start.ts` and `stop.ts` (the second argument to
`commands.command(name, description, handler)`).

To change the menu: edit the description in those files and redeploy. Next
cold start will sync the new list.

## Useful diagnostics

```bash
bunx wrangler tail telegram-notify --format=pretty   # live Worker logs
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"   # what Telegram thinks
curl "https://api.telegram.org/bot$BOT_TOKEN/getMyCommands"    # registered command list
```
