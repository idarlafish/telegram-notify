// Reset the bot's default menu button to Telegram's stock behavior
// (no custom Web App URL, just the standard commands menu).
//
// Run:  BOT_TOKEN=... bun run scripts/reset-menu-button.ts          # clear → "default"
//       BOT_TOKEN=... bun run scripts/reset-menu-button.ts commands # show /commands
//       BOT_TOKEN=... MINI_APP_URL=https://telegram-notify.la.fish/ MINI_APP_TEXT=Reminders \
//         bun run scripts/reset-menu-button.ts webapp                # set to our Mini App
//
// Only affects the menu button (≡ icon at bottom-left). Profile-level
// Mini App registrations live in BotFather only and cannot be touched here.
export {};

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN env var required");
  process.exit(1);
}

const mode = process.argv[2] ?? "default";

let menu_button: unknown;
if (mode === "default") {
  menu_button = { type: "default" };
} else if (mode === "commands") {
  menu_button = { type: "commands" };
} else if (mode === "webapp") {
  const url = process.env.MINI_APP_URL;
  const text = process.env.MINI_APP_TEXT ?? "Open";
  if (!url) {
    console.error("MINI_APP_URL env var required for webapp mode");
    process.exit(1);
  }
  menu_button = { type: "web_app", text, web_app: { url } };
} else {
  console.error(`unknown mode: ${mode}`);
  process.exit(1);
}

const r = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ menu_button }),
});
const json = await r.json() as { ok: boolean; result?: unknown; description?: string };
console.log(JSON.stringify(json, null, 2));
