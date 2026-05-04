import type { Env } from "../../env";
import type { UserSchedulerDO } from "./index";

export function userDoStub(env: Env, telegramUserId: number): DurableObjectStub<UserSchedulerDO> {
  const id = env.USER_SCHEDULER.idFromName(`user:${telegramUserId}`);
  return env.USER_SCHEDULER.get(id) as DurableObjectStub<UserSchedulerDO>;
}
