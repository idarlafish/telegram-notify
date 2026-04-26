// Cloudflare Worker bindings (matches wrangler.toml).
export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  MESSAGE_KEY: string;   // base64-encoded 32-byte AES-256-GCM key
  ASSETS: Fetcher;
}
