// Cloudflare Worker bindings (matches wrangler.toml).
export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  ASSETS: Fetcher;
}
