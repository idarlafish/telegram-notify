import type { Env } from "../env";

// `id` is the Telegram user id (also our PK). `chat_id` is where notifications
// are delivered — equal to `id` in private chats; differs for groups.
export interface User {
  id: number;
  chat_id: number;
  created_at: number;
}

export async function upsertUser(env: Env, id: number, chatId: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, chat_id) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET chat_id = excluded.chat_id`,
  )
    .bind(id, chatId)
    .run();
}

export async function getUser(env: Env, id: number): Promise<User | null> {
  return env.DB.prepare(
    `SELECT id, chat_id, created_at FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<User>();
}
