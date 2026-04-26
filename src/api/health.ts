import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoutes = new Hono<{ Bindings: Env }>()
  .get("/", (c) => c.json({ status: "ok" }))
  // Cron heartbeat. KV TTL means "no value" already implies "stale" (key
  // expires after 10 min, longer than our 1-min cadence). Endpoint surfaces
  // presence + diagnostic age. Wire an external uptime monitor (cron-job.org,
  // UptimeRobot, BetterStack, …) to alert on non-200.
  .get("/cron", async (c) => {
    const raw = await c.env.CRON_STATE.get("last_cron_tick_at");
    if (!raw) return c.json({ stale: true, last_tick_at: null }, 503);
    const lastMs = Number(raw);
    if (!Number.isFinite(lastMs)) {
      return c.json({ stale: true, last_tick_at: null, reason: "non-numeric KV value" }, 503);
    }
    const ageMs = Date.now() - lastMs;
    return c.json({ stale: false, last_tick_at: lastMs, age_ms: ageMs }, 200);
  });
