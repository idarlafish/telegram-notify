import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { notificationsRoutes } from "./notifications";
import { handleTelegramWebhook } from "../telegram/webhook";
import type { Env } from "../env";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["authorization", "content-type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  // Cron heartbeat — KV TTL means "no value" already implies "stale" (key
  // expires after 10 min, longer than our 1-min cadence). Endpoint just
  // surfaces presence + diagnostic age. Wire an external uptime monitor
  // (cron-job.org, UptimeRobot, BetterStack, …) to alert on non-200.
  app.get("/health/cron", async (c) => {
    const raw = await c.env.CRON_STATE.get("last_cron_tick_at");
    if (!raw) return c.json({ stale: true, last_tick_at: null }, 503);
    const lastMs = Number(raw);
    if (!Number.isFinite(lastMs)) {
      return c.json({ stale: true, last_tick_at: null, reason: "non-numeric KV value" }, 503);
    }
    const ageMs = Date.now() - lastMs;
    return c.json({ stale: false, last_tick_at: lastMs, age_ms: ageMs }, 200);
  });

  app.post("/telegram-webhook", (c) => handleTelegramWebhook(c.req.raw, c.env));
  app.route("/api/notifications", notificationsRoutes);

  // Anything not matched above is a frontend route — hand it to the asset
  // binding, which serves real files or falls back to index.html (SPA mode).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError(errorHandler);
  return app;
}
