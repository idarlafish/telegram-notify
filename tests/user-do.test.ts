import { describe, it, expect } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { notifications } from "../src/scheduler/user-do/schema";

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

async function getAlarm(userId: number): Promise<number | null> {
  const id = env.USER_SCHEDULER.idFromName(`user:${userId}`);
  return runInDurableObject(env.USER_SCHEDULER.get(id), async (_instance, ctx) => ctx.storage.getAlarm());
}

describe("UserSchedulerDO — create + refreshAlarm", () => {
  it("creates a recurring notification and sets alarm to next_fire_at", async () => {
    const s = stub(20);
    await s.bind(20);
    const created = await s.create({
      kind: "recurring",
      time: "10:00",
      timezone: "Europe/Helsinki",
      message: "standup",
      days: ["mon", "tue", "wed", "thu", "fri"],
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.kind).toBe("recurring");
    expect(created.message).toBe("standup");
    expect(created.days).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(created.next_fire_at).toBeGreaterThan(Date.now());

    expect(await getAlarm(20)).toBe(created.next_fire_at);
  });

  it("creating a second, earlier reminder shifts the alarm earlier", async () => {
    const s = stub(21);
    await s.bind(21);
    const a = await s.create({
      kind: "one_time",
      time: "23:59",
      timezone: "Europe/Helsinki",
      message: "late",
      date: "2099-12-31",
    });
    const b = await s.create({
      kind: "one_time",
      time: "00:01",
      timezone: "Europe/Helsinki",
      message: "early",
      date: "2030-01-01",
    });
    expect(b.next_fire_at).toBeLessThan(a.next_fire_at);

    expect(await getAlarm(21)).toBe(b.next_fire_at);
  });
});

describe("UserSchedulerDO — update", () => {
  it("updates time and recomputes next_fire_at", async () => {
    const s = stub(30);
    await s.bind(30);
    const created = await s.create({
      kind: "recurring",
      time: "10:00",
      timezone: "Europe/Helsinki",
      message: "m",
      days: ["mon"],
    });
    const updated = await s.update(created.id, { time: "14:00" });
    expect(updated?.time).toBe("14:00");
    expect(updated?.next_fire_at).not.toBe(created.next_fire_at);
  });

  it("returns null on unknown id", async () => {
    const s = stub(31);
    await s.bind(31);
    const r = await s.update("00000000-0000-0000-0000-000000000000", { time: "12:00" });
    expect(r).toBeNull();
  });
});

describe("UserSchedulerDO — delete", () => {
  it("deletes a row and clears alarm if it was the last", async () => {
    const s = stub(40);
    await s.bind(40);
    const created = await s.create({
      kind: "one_time",
      time: "12:00",
      timezone: "Europe/Helsinki",
      message: "x",
      date: "2099-01-01",
    });
    expect(await s.delete(created.id)).toBe(true);
    expect(await s.list()).toEqual([]);
    expect(await getAlarm(40)).toBeNull();
  });

  it("returns false on unknown id", async () => {
    const s = stub(41);
    await s.bind(41);
    expect(await s.delete("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});

type DOInternals = {
  db: import("drizzle-orm/durable-sqlite").DrizzleSqliteDODatabase<{ notifications: typeof notifications }>;
  alarm: () => Promise<void>;
};

async function forceFire(userId: number): Promise<void> {
  const id = env.USER_SCHEDULER.idFromName(`user:${userId}`);
  await runInDurableObject(env.USER_SCHEDULER.get(id), async (instance) => {
    const i = instance as unknown as DOInternals;
    await i.db.update(notifications).set({ next_fire_at: Date.now() - 1000 });
    await i.alarm();
  });
}

describe("UserSchedulerDO — alarm", () => {
  it("fires a single one-time notification and deletes the row", async () => {
    const s = stub(50);
    await s.bind(50);
    await s.create({
      kind: "one_time", time: "12:00", timezone: "Europe/Helsinki",
      message: "ping", date: "2099-01-01",
    });
    await forceFire(50);
    expect(await s.list()).toEqual([]);
  });

  it("fires multiple due rows in one alarm and reschedules recurring", async () => {
    const s = stub(51);
    await s.bind(51);
    await s.create({
      kind: "recurring", time: "10:00", timezone: "Europe/Helsinki",
      message: "a", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    });
    await s.create({
      kind: "recurring", time: "10:00", timezone: "Europe/Helsinki",
      message: "b", days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    });
    await forceFire(51);
    const after = await s.list();
    expect(after).toHaveLength(2);
    for (const r of after) expect(r.next_fire_at).toBeGreaterThan(Date.now());
  });
});
