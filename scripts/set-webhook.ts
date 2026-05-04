import { Bot } from "grammy";

const args = process.argv.slice(2);
const envFlag = args.indexOf("--env");
const isStaging = envFlag !== -1 && args[envFlag + 1] === "staging";

const token = isStaging ? process.env.BOT_STAGING_TOKEN : process.env.BOT_TOKEN;
const secret = isStaging ? process.env.STAGING_WEBHOOK_SECRET : process.env.WEBHOOK_SECRET;
const url = isStaging
  ? "https://telegram-notify-staging.la.fish/telegram-webhook"
  : "https://telegram-notify.la.fish/telegram-webhook";

if (!token || !secret) {
  const required = isStaging
    ? "BOT_STAGING_TOKEN and STAGING_WEBHOOK_SECRET"
    : "BOT_TOKEN and WEBHOOK_SECRET";
  console.error(`${required} must be set`);
  process.exit(1);
}

const bot = new Bot(token);
await bot.api.setWebhook(url, {
  secret_token: secret,
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
});
console.log(`webhook set: ${url}`);
