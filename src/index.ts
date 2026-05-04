import { createApp } from "./api/app";
import type { Env } from "./env";

export { UserSchedulerDO } from "./scheduler/user-do";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};
