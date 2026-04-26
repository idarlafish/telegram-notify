import { eq } from "drizzle-orm";
import { db } from "./client";
import { users, type User } from "./schema";
import type { Env } from "../env";

export type { User };

export async function upsertUser(env: Env, id: number, chatId: number): Promise<void> {
  await db(env)
    .insert(users)
    .values({ id, chat_id: chatId })
    .onConflictDoUpdate({ target: users.id, set: { chat_id: chatId } });
}

export async function getUser(env: Env, id: number): Promise<User | null> {
  const [row] = await db(env).select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
