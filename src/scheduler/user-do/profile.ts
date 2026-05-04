import type { Profile } from "./types";

export async function bindProfile(storage: DurableObjectStorage, chatId: number): Promise<void> {
  const existing = await storage.get<Profile>("profile");
  await storage.put<Profile>("profile", {
    chat_id: chatId,
    created_at: existing?.created_at ?? Date.now(),
  });
}

export async function getProfile(storage: DurableObjectStorage): Promise<Profile | null> {
  return (await storage.get<Profile>("profile")) ?? null;
}

export async function destroyProfile(storage: DurableObjectStorage): Promise<void> {
  await storage.deleteAll();
  await storage.deleteAlarm();
}
