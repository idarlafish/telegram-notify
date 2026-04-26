// Register the bot's command list shown in Telegram's slash menu.
// Run once (and after every command-list change):
//   BOT_TOKEN=... bun run scripts/set-commands.ts
import { Bot } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN env var required");
  process.exit(1);
}

const bot = new Bot(token);
await bot.api.setMyCommands([
  { command: "start", description: "Begin or refresh your session" },
  { command: "stop",  description: "Erase all your reminders and account data" },
]);
console.log("commands set");
