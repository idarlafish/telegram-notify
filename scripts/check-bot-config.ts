// Print every bit of bot config that the Telegram Bot API exposes.
// Useful to identify stray Mini App / menu button URLs left from old setups.
//
// Run:  BOT_TOKEN=... bun run scripts/check-bot-config.ts
//
// Note: profile-level Mini App URLs (set via @BotFather → /myapps) are NOT
// exposed by the Bot API. If a Start/Open-App button still points at a stale
// URL after running this, that registration lives in BotFather only.
import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN env var required");
  process.exit(1);
}

const bot = new Bot(token);
const calls = {
  getMe: () => bot.api.getMe(),
  getMyName: () => bot.api.getMyName(),
  getMyDescription: () => bot.api.getMyDescription(),
  getMyShortDescription: () => bot.api.getMyShortDescription(),
  getMyCommands: () => bot.api.getMyCommands(),
  getChatMenuButton: () => bot.api.getChatMenuButton(),
  getMyDefaultAdministratorRights: () => bot.api.getMyDefaultAdministratorRights(),
  getWebhookInfo: () => bot.api.getWebhookInfo(),
};

for (const [name, call] of Object.entries(calls)) {
  console.log(`\n=== ${name} ===`);
  try {
    console.log(JSON.stringify(await call(), null, 2));
  } catch (err) {
    console.log(`  error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
