import { describe, it, expect } from "vitest";
import { healthRoutes } from "../src/api/health";
import type { Env } from "../src/env";

function fakeEnv(kvValue: string | null): Env {
  return {
    CRON_STATE: { get: async () => kvValue } as unknown as KVNamespace,
  } as unknown as Env;
}

async function call(env: Env, path: string): Promise<{ status: number; body: unknown }> {
  const r = await healthRoutes.fetch(new Request(`http://test${path}`), env);
  return { status: r.status, body: await r.json() };
}

describe("/health (root)", () => {
  it("returns 200 OK", async () => {
    const { status, body } = await call(fakeEnv(null), "/");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});

describe("/health/cron", () => {
  it("503 when KV has never been written", async () => {
    const { status, body } = await call(fakeEnv(null), "/cron");
    expect(status).toBe(503);
    expect(body).toMatchObject({ stale: true, last_tick_at: null });
  });

  it("200 with diagnostic age when KV has a recent timestamp", async () => {
    const lastMs = Date.now() - 5_000;
    const { status, body } = await call(fakeEnv(String(lastMs)), "/cron");
    expect(status).toBe(200);
    expect(body).toMatchObject({ stale: false, last_tick_at: lastMs });
    const ageMs = (body as { age_ms: number }).age_ms;
    expect(ageMs).toBeGreaterThanOrEqual(5_000);
    expect(ageMs).toBeLessThan(10_000); // reasonable upper bound for the test runtime
  });

  it("503 with reason when KV value is non-numeric (corruption guard)", async () => {
    const { status, body } = await call(fakeEnv("not-a-number"), "/cron");
    expect(status).toBe(503);
    expect(body).toMatchObject({ stale: true, reason: "non-numeric KV value" });
  });
});
