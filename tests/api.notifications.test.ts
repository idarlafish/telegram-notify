import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError } from "../src/lib/errors";
import type { Env } from "../src/env";
import type { NotificationRow } from "../src/db/notifications";
import type { User } from "../src/db/schema";

const dbMocks = vi.hoisted(() => ({
  createNotification: vi.fn(),
  listByUser: vi.fn(),
  updateNotification: vi.fn(),
  deleteNotification: vi.fn(),
  MAX_NOTIFICATIONS_PER_USER: 50,
}));
vi.mock("../src/db/notifications", () => dbMocks);

const userMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  upsertUser: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("../src/db/users", () => userMocks);

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
const dbUser: User = { id: 100, chat_id: 100, created_at: 0 };

const fakeRow: NotificationRow = {
  id: "n1",
  user_id: 100,
  message: "hello",
  time: "10:00",
  timezone: "Europe/Helsinki",
  kind: "one_time",
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
  userMocks.getUser.mockResolvedValue(dbUser);
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

  it("401 when user has not run /start (no DB row)", async () => {
    userMocks.getUser.mockResolvedValueOnce(null);
    const { status, body } = await call("GET", "/api/notifications");
    expect(status).toBe(401);
    expect(body).toMatchObject({ message: expect.stringContaining("/start") });
  });
});

describe("POST /api/notifications", () => {
  it("201 with the created notification", async () => {
    dbMocks.createNotification.mockResolvedValue(fakeRow);
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(201);
    expect(body).toEqual({ notification: fakeRow });
    expect(dbMocks.createNotification).toHaveBeenCalledWith(fakeEnv, 100, validBody);
  });

  it("409 when the per-user reminder cap is reached", async () => {
    dbMocks.createNotification.mockRejectedValue(
      new ConflictError("reminder limit (50) reached"),
    );
    const { status, body } = await call("POST", "/api/notifications", validBody);
    expect(status).toBe(409);
    expect(body).toMatchObject({ error: "conflict", message: /limit \(50\)/ });
  });
});

describe("PATCH /api/notifications/:id", () => {
  it("200 with the updated notification", async () => {
    const updated = { ...fakeRow, message: "edited" };
    dbMocks.updateNotification.mockResolvedValue(updated);
    const { status, body } = await call("PATCH", "/api/notifications/n1", { message: "edited" });
    expect(status).toBe(200);
    expect(body).toEqual({ notification: updated });
    expect(dbMocks.updateNotification).toHaveBeenCalledWith(fakeEnv, 100, "n1", { message: "edited" });
  });

  it("404 when the id does not belong to the user", async () => {
    dbMocks.updateNotification.mockResolvedValue(null);
    const { status } = await call("PATCH", "/api/notifications/missing", { message: "x" });
    expect(status).toBe(404);
  });
});

describe("DELETE /api/notifications/:id", () => {
  it("200 when the row is deleted", async () => {
    dbMocks.deleteNotification.mockResolvedValue(true);
    const { status, body } = await call("DELETE", "/api/notifications/n1");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(dbMocks.deleteNotification).toHaveBeenCalledWith(fakeEnv, 100, "n1");
  });

  it("404 when the row is missing or not the caller's", async () => {
    dbMocks.deleteNotification.mockResolvedValue(false);
    const { status } = await call("DELETE", "/api/notifications/n1");
    expect(status).toBe(404);
  });
});
