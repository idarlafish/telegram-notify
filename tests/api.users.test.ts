import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../src/env";

const stubMethods = vi.hoisted(() => ({
  bind: vi.fn(),
  destroy: vi.fn(),
  profile: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../src/scheduler/user-do/stub", () => ({
  userDoStub: () => stubMethods,
}));

const authMocks = vi.hoisted(() => ({
  verifyInitData: vi.fn(),
}));
vi.mock("../src/telegram/auth", () => authMocks);

import { createApp } from "../src/api/app";

const fakeEnv = {
  BOT_TOKEN: "test:token",
  ANALYTICS: { writeDataPoint: vi.fn() },
} as unknown as Env;

const tgUser = { id: 100, first_name: "Test" };
const profile = { chat_id: 100, created_at: 0 };

async function call(
  method: string,
  path: string,
  headers: Record<string, string> = { authorization: "tma stub" },
) {
  const res = await fakeEnv.ANALYTICS;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...headers },
  };
  const res2 = await (await createApp()).fetch(new Request(`http://test${path}`, init), fakeEnv);
  const json = await res2.json().catch(() => null);
  return { status: res2.status, body: json };
}

const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.verifyInitData.mockResolvedValue(tgUser);
  stubMethods.profile.mockResolvedValue(profile);
});

describe("GET /api/users/me", () => {
  it("200 with the authenticated user profile", async () => {
    const init: RequestInit = {
      method: "GET",
      headers: { authorization: "tma stub" },
    };
    const res = await app.fetch(new Request("http://test/api/users/me", init), fakeEnv);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ profile });
  });
});

describe("DELETE /api/users/me", () => {
  it("200 and calls destroy on the DO", async () => {
    stubMethods.destroy.mockResolvedValue(undefined);
    const init: RequestInit = {
      method: "DELETE",
      headers: { authorization: "tma stub" },
    };
    const res = await app.fetch(new Request("http://test/api/users/me", init), fakeEnv);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(stubMethods.destroy).toHaveBeenCalledOnce();
  });

  it("401 when unauthorized", async () => {
    const init: RequestInit = { method: "DELETE" };
    const res = await app.fetch(new Request("http://test/api/users/me", init), fakeEnv);
    expect(res.status).toBe(401);
    expect(stubMethods.destroy).not.toHaveBeenCalled();
  });
});
