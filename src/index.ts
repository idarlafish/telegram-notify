import { createApp } from "./api/app";
import { fireDueNotifications } from "./scheduler/tick";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await fireDueNotifications(env);
  },
};
