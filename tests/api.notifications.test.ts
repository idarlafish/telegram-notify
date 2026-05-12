import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, InternalError, PastDateError, ValidationError } from "../src/lib/errors";
import type { Env } from "../src/env";
import type { Notification } from "../src/scheduler/user-do/types";

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

const fakeRow: Notification = {
  id: "n1",
  kind: "one_time",
  time: "10:00",
  timezone: "Europe/Helsinki",
  message: "hello",
  date: "2099-01-01",
  next_fire_at: 1_700_000_000_000,
  last_sent_at: null,
  created_at: 0,
};

const validBody = {
  kind: "one_time",
  time: "10:00",
  timezone: "Europe/Helsinki",
  message: "hello",
  date: "2099-01-01",
};

const app = createApp();

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { authorization: "tma stub" },
) {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", ...headers },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await app.fetch(new Request(`http://test${path}`, init), fakeEnv);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.verifyInitData.mockResolvedValue(tgUser);
  stubMethods.profile.mockResolvedValue(profile);
});

describe("auth on /api/notifications", () => {
  it("401 when authorization header is missing", async () => {
    const { status } = await call("GET", "/api/notifications", undefined, {});
    expect(status).toBe(401);
  });

  it("401 when initData fails to verify", async () => {
    authMocks.verifyInitData.mockResolvedValueOnce(null);
    const { status } = await call("GET", "/api/notifications");
    expect(status).toBe(401);
  });

  it("401 when user has not run /start (DO profile null)", async () => {
    stubMethods.profile.mockResolvedValueOnce(null);
    const { status, body } = await call("GET", "/api/notifications");
    expect(status).toBe(401);
    expect(body).toMatchObject({ message: expect.stringContaining("/start") });
  });
});

describe("POST /api/notifications", () => {
  it("201 with the created notification", async () => {
    stubMethods.create.mockResolvedValue(fakeRow);
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(201);
    expect(body).toEqual({ notification: fakeRow });
    expect(stubMethods.create).toHaveBeenCalledWith(validBody);
  });

  it("409 when the per-user reminder cap is reached", async () => {
    stubMethods.create.mockRejectedValue(new ConflictError("reminder limit (50) reached"));
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: "conflict", message: /limit \(50\)/ });
  });

  it("400 when DO returns a past-date error", async () => {
    stubMethods.create.mockRejectedValue(new PastDateError());
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "past_date" });
  });

  it("400 when DO returns a validation error", async () => {
    stubMethods.create.mockRejectedValue(new ValidationError("invalid time: 25:99"));
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "validation_error", message: "invalid time: 25:99" });
  });

  it("500 with hidden details when DO returns an internal error", async () => {
    stubMethods.create.mockRejectedValue(new InternalError("secret details"));
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(500);
    expect(body).toEqual({ error: "internal", message: "internal error" });
  });
});

describe("PATCH /api/notifications/:id", () => {
  it("200 with the updated notification", async () => {
    const updated = { ...fakeRow, message: "edited" };
    stubMethods.update.mockResolvedValue(updated);
    const { status, body } = await call("PATCH", "/api/notifications/n1", { message: "edited" });
    expect(status).toBe(200);
    expect(body).toEqual({ notification: updated });
    expect(stubMethods.update).toHaveBeenCalledWith("n1", { message: "edited" });
  });

  it("404 when the id does not belong to the user", async () => {
    stubMethods.update.mockResolvedValue(null);
    const { status } = await call("PATCH", "/api/notifications/missing", { message: "x" });
    expect(status).toBe(404);
  });
});

describe("DELETE /api/notifications/:id", () => {
  it("200 when the row is deleted", async () => {
    stubMethods.delete.mockResolvedValue(true);
    const { status, body } = await call("DELETE", "/api/notifications/n1");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(stubMethods.delete).toHaveBeenCalledWith("n1");
  });

  it("404 when the row is missing or not the caller's", async () => {
    stubMethods.delete.mockResolvedValue(false);
    const { status } = await call("DELETE", "/api/notifications/n1");
    expect(status).toBe(404);
  });
});
