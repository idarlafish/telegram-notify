import { userDoStub } from "../scheduler/user-do/stub";
import type { Notification, NotificationInput, UpdateInput } from "../scheduler/user-do/types";
import type { Env } from "../env";
import { PastDateError } from "../lib/errors";

function normalizeCreateError(err: unknown): never {
  if (err instanceof Error && err.message === "one-time reminder must be in the future") {
    throw new PastDateError();
  }
  throw err;
}

export async function listNotifications(env: Env, telegramUserId: number): Promise<Notification[]> {
  return userDoStub(env, telegramUserId).list();
}

export async function createNotification(
  env: Env,
  telegramUserId: number,
  input: NotificationInput,
): Promise<Notification> {
  try {
    return await userDoStub(env, telegramUserId).create(input);
  } catch (err) {
    normalizeCreateError(err);
  }
}

export async function updateNotification(
  env: Env,
  telegramUserId: number,
  id: string,
  patch: UpdateInput,
): Promise<Notification | null> {
  return userDoStub(env, telegramUserId).update(id, patch);
}

export async function deleteNotification(
  env: Env,
  telegramUserId: number,
  id: string,
): Promise<boolean> {
  return userDoStub(env, telegramUserId).delete(id);
}
