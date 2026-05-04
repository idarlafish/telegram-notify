import { describe, it, expect } from "vitest";
import { healthRoutes } from "../src/api/health";
import type { Env } from "../src/env";

const fakeEnv = {} as Env;

async function call(path: string): Promise<{ status: number; body: unknown }> {
  const r = await healthRoutes.fetch(new Request(`http://test${path}`), fakeEnv);
  return { status: r.status, body: await r.json() };
}

describe("/health", () => {
  it("returns 200 OK", async () => {
    const { status, body } = await call("/");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
