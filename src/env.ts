// Cloudflare Worker bindings (matches wrangler.toml).
export interface Env {
  DB: D1Database;
  CRON_STATE: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  MESSAGE_KEY: string;   // base64-encoded 32-byte AES-256-GCM key
  OLD_MESSAGE_KEY?: string; // optional — set during a key rotation window only
  ASSETS: Fetcher;
}
