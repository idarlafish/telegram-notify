// Set the Telegram bot's webhook URL. Run once after first deploy:
//   BOT_TOKEN=... WEBHOOK_URL=https://telegram-notify.la.fish/telegram-webhook \
//   WEBHOOK_SECRET=... bun run scripts/set-webhook.ts

const token = process.env.BOT_TOKEN;
const url = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;

if (!token || !url || !secret) {
  console.error("BOT_TOKEN, WEBHOOK_URL, WEBHOOK_SECRET must all be set");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
  }),
});

console.log(await res.json());
