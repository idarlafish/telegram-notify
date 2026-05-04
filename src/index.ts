import { createApp } from "./api/app";
import { runCronTick } from "./scheduler/tick";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    await runCronTick(env, Date.now(), event.scheduledTime);
  },
};
