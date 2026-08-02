import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("../src/telegram/bot", () => ({
  createBot: () => ({ api: { sendMessage } }),
}));

import { deliver } from "../src/scheduler/user-do/delivery";

const env = {} as Env;

describe("deliver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when the message sends", async () => {
    sendMessage.mockResolvedValue(undefined);
    expect(await deliver(env, 1, "hi", "n1")).toEqual({ kind: "ok" });
  });

  it("classifies 429 as rate_limited with the server's retry_after", async () => {
    sendMessage.mockRejectedValue({ error_code: 429, parameters: { retry_after: 15 } });
    expect(await deliver(env, 1, "hi", "n1")).toEqual({
      kind: "rate_limited",
      retryAfterMs: 15_000,
    });
  });

  it("defaults rate_limited to 30s when the server omits retry_after", async () => {
    sendMessage.mockRejectedValue({ error_code: 429, description: "Too Many Requests" });
    expect(await deliver(env, 1, "hi", "n1")).toEqual({
      kind: "rate_limited",
      retryAfterMs: 30_000,
    });
  });

  it("classifies a blocked bot (403) as unreachable", async () => {
    sendMessage.mockRejectedValue({
      error_code: 403,
      description: "Forbidden: bot was blocked by the user",
    });
    expect((await deliver(env, 1, "hi", "n1")).kind).toBe("unreachable");
  });

  it("classifies chat not found (400) as unreachable", async () => {
    sendMessage.mockRejectedValue({ error_code: 400, description: "Bad Request: chat not found" });
    expect((await deliver(env, 1, "hi", "n1")).kind).toBe("unreachable");
  });

  it("classifies a server error as transient", async () => {
    sendMessage.mockRejectedValue({ error_code: 500, description: "Internal Server Error" });
    expect((await deliver(env, 1, "hi", "n1")).kind).toBe("transient");
  });
});
