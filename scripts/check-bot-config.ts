// Print every bit of bot config that the Telegram Bot API exposes.
// Useful to identify stray Mini App / menu button URLs left from old setups.
//
// Run:  BOT_TOKEN=... bun run scripts/check-bot-config.ts
// Note: profile-level Mini App URLs (set via @BotFather → /myapps or
// Bot Settings → Configure Mini App) are NOT exposed by the Bot API. If a
// Start/Open-App button still points at ngrok after running this, that
// registration lives in BotFather only.
export {};

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN env var required");
  process.exit(1);
}

const ENDPOINTS = [
  "getMe",
  "getMyName",
  "getMyDescription",
  "getMyShortDescription",
  "getMyCommands",
  "getChatMenuButton",         // no chat_id → default for all chats
  "getMyDefaultAdministratorRights",
  "getWebhookInfo",
] as const;

for (const ep of ENDPOINTS) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${ep}`);
  const json = await r.json() as { ok: boolean; result?: unknown; description?: string };
  console.log(`\n=== ${ep} ===`);
  if (!json.ok) {
    console.log(`  error: ${json.description}`);
    continue;
  }
  console.log(JSON.stringify(json.result, null, 2));
}
