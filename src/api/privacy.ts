import { Hono } from "hono";

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Sleepy Notify</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 640px; margin: 0 auto; padding: 32px 20px 64px;
         background: #fff; color: #1a1a1a; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  p, ul { margin: 0 0 12px; }
  ul { padding-left: 22px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  code { background: rgba(127,127,127,0.15); padding: 1px 6px; border-radius: 4px; }
  a { color: #2481cc; }
</style>
</head>
<body>

<h1>Privacy Policy</h1>
<p class="meta">Sleepy Notify — last updated 2026-04-26</p>

<h2>What we store</h2>
<p>When you send <code>/start</code>, we store your Telegram user ID and chat ID
so the bot can deliver reminders to you. When you create a reminder, we store
its time, recurrence pattern, timezone, and message text.</p>
<p>That is the entire dataset. We do not collect your name, contact list,
location, or any other Telegram metadata.</p>

<h2>How it's protected</h2>
<p>Reminder messages are encrypted at the application layer (AES-256-GCM with
a per-record initialization vector) before being written to the database. The
encryption key is held only by the deployed Worker, not in the database.
Storage itself is Cloudflare D1, which is also encrypted at rest.</p>

<h2>Where it's stored</h2>
<p>In Cloudflare D1 — a SQLite-backed database hosted on Cloudflare's
infrastructure. Data lives in Cloudflare's regional datacenters; no copies are
exported to other providers.</p>

<h2>Who can see it</h2>
<p>Only the bot operator (via Cloudflare account access) and Cloudflare itself
as the infrastructure provider. We never sell, share, or use your data for
advertising, analytics, or model training.</p>

<h2>How long we keep it</h2>
<p>Until you delete it. Reminders persist until you remove them in the Mini
App. Sending <code>/stop</code> to the bot erases your account and every
reminder you've created — immediately, with no grace period.</p>

<h2>Your rights</h2>
<ul>
  <li><strong>Delete everything:</strong> send <code>/stop</code> to the bot.</li>
  <li><strong>Delete a single reminder:</strong> tap it in the Mini App, then Delete.</li>
  <li><strong>Questions or requests:</strong> contact
    <a href="mailto:idar.dev@pm.me">idar.dev@pm.me</a>.</li>
</ul>

<h2>Changes</h2>
<p>If this policy changes, the "last updated" date above will reflect it.
Material changes will be announced via a bot message.</p>

</body>
</html>`;

export const privacyRoute = new Hono()
  .get("/", (c) => c.html(HTML));
