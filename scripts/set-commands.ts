import { Bot } from "grammy";

const args = process.argv.slice(2);
const envFlag = args.indexOf("--env");
const isStaging = envFlag !== -1 && args[envFlag + 1] === "staging";

const token = isStaging ? process.env.BOT_STAGING_TOKEN : process.env.BOT_TOKEN;
if (!token) {
  console.error(`${isStaging ? "BOT_STAGING_TOKEN" : "BOT_TOKEN"} env var required`);
  process.exit(1);
}

const bot = new Bot(token);
await bot.api.setMyCommands([
  { command: "start", description: "Begin or refresh your session" },
  { command: "stop",  description: "Erase all your reminders and account data" },
]);
console.log(`commands set${isStaging ? " (staging)" : ""}`);
