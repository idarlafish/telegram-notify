import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    USER_SCHEDULER: DurableObjectNamespace;
    MESSAGE_KEY: string;
    BOT_TOKEN: string;
  }
}

function stub(userId: number) {
  const id = env.USER_SCHEDULER.idFromName(`user:${userId}`);
  return env.USER_SCHEDULER.get(id);
}

describe("UserSchedulerDO — profile lifecycle", () => {
  it("profile() returns null before bind", async () => {
    const profile = await stub(1).profile();
    expect(profile).toBeNull();
  });

  it("bind sets chat_id and created_at; subsequent bind preserves created_at", async () => {
    const s = stub(2);
    await s.bind(1234);
    const p1 = await s.profile();
    expect(p1?.chat_id).toBe(1234);
    expect(typeof p1?.created_at).toBe("number");

    const originalCreatedAt = p1!.created_at;
    await new Promise((r) => setTimeout(r, 5));
    await s.bind(5678);
    const p2 = await s.profile();
    expect(p2?.chat_id).toBe(5678);
    expect(p2?.created_at).toBe(originalCreatedAt);
  });

  it("destroy clears profile", async () => {
    const s = stub(3);
    await s.bind(99);
    expect((await s.profile())?.chat_id).toBe(99);
    await s.destroy();
    expect(await s.profile()).toBeNull();
  });
});

describe("UserSchedulerDO — list", () => {
  it("returns [] when DO is empty", async () => {
    const items = await stub(10).list();
    expect(items).toEqual([]);
  });
});
