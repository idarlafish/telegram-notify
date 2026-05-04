import { userDoStub } from "../scheduler/user-do/stub";
import type {
  Notification,
  NotificationInput,
  UpdateInput,
} from "../scheduler/user-do/types";
import type { Env } from "../env";

export async function listNotifications(env: Env, telegramUserId: number): Promise<Notification[]> {
  return userDoStub(env, telegramUserId).list();
}

export async function createNotification(
  env: Env,
  telegramUserId: number,
  input: NotificationInput,
): Promise<Notification> {
  return userDoStub(env, telegramUserId).create(input);
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
