import { userDoStub } from "../scheduler/user-do/stub";
import type { Profile } from "../scheduler/user-do/types";
import type { Env } from "../env";

export async function bindUser(env: Env, telegramUserId: number, chatId: number): Promise<void> {
  await userDoStub(env, telegramUserId).bind(chatId);
}

export async function destroyUser(env: Env, telegramUserId: number): Promise<void> {
  await userDoStub(env, telegramUserId).destroy();
}

export async function getProfile(env: Env, telegramUserId: number): Promise<Profile | null> {
  return userDoStub(env, telegramUserId).profile();
}
