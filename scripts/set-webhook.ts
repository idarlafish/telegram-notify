// Set the Telegram bot's webhook URL. Run once after first deploy:
//   BOT_TOKEN=... WEBHOOK_URL=https://telegram-notify.la.fish/telegram-webhook \
//   WEBHOOK_SECRET=... bun run scripts/set-webhook.ts
import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
const url = process.env.WEBHOOK_URL;
const secret = process.env.WEBHOOK_SECRET;

if (!token || !url || !secret) {
  console.error("BOT_TOKEN, WEBHOOK_URL, WEBHOOK_SECRET must all be set");
  process.exit(1);
}

const bot = new Bot(token);
await bot.api.setWebhook(url, {
  secret_token: secret,
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
});
console.log("webhook set");
