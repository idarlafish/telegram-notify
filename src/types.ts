// Cloudflare Worker bindings (matches wrangler.toml).
export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
}

export interface User {
  id: number;
  chat_id: number;
  created_at: number;
}

export interface Notification {
  id: string;
  user_id: number;
  time: string;            // "HH:MM"
  timezone: string;        // IANA tz
  message: string;
  next_fire_at: number;    // UTC ms
  last_sent_at: number | null;
  created_at: number;
}

// Shape posted from the Mini App (no server-set fields).
export interface NotificationInput {
  time: string;
  timezone: string;
  message: string;
}
