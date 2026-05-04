import { Bot } from "grammy";

const args = process.argv.slice(2);
const envFlag = args.indexOf("--env");
const isStaging = envFlag !== -1 && args[envFlag + 1] === "staging";

const token = isStaging ? process.env.STAGING_BOT_TOKEN : process.env.BOT_TOKEN;
const secret = isStaging ? process.env.STAGING_WEBHOOK_SECRET : process.env.WEBHOOK_SECRET;
const url = isStaging ? process.env.STAGING_WEBHOOK_URL : process.env.WEBHOOK_URL;

if (!token || !secret || !url) {
  const required = isStaging
    ? "STAGING_BOT_TOKEN, STAGING_WEBHOOK_SECRET, STAGING_WEBHOOK_URL"
    : "BOT_TOKEN, WEBHOOK_SECRET, WEBHOOK_URL";
  console.error(`${required} must be set in .env`);
  process.exit(1);
}

const bot = new Bot(token);
await bot.api.setWebhook(url, {
  secret_token: secret,
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
});
console.log(`webhook set: ${url}`);
