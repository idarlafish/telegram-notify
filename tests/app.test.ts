import { describe, it, expect } from "vitest";
import { createApp } from "../src/api/app";
import type { Env } from "../src/env";

describe("app routing", () => {
  it("returns 404 for unmatched paths (assets + SPA fallback are served by the platform)", async () => {
    const app = createApp();
    const req = new Request("https://x/vendor/phpunit/eval-stdin.php", {
      method: "POST",
      body: "malicious-payload",
    });

    const res = await app.fetch(req, {} as Env, {} as ExecutionContext);

    expect(res.status).toBe(404);
  });

  it("serves /health from the Worker", async () => {
    const app = createApp();

    const res = await app.fetch(new Request("https://x/health"), {} as Env, {} as ExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
