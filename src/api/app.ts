import { Hono } from "hono";
import { errorHandler } from "./middleware/error";
import { notificationsRoutes } from "./notifications";
import { usersRoutes } from "./users";
import { healthRoutes } from "./health";
import { handleTelegramWebhook } from "../telegram/webhook";
import type { Env } from "../env";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.route("/health", healthRoutes);
  app.post("/telegram-webhook", (c) => handleTelegramWebhook(c.req.raw, c.env));
  app.route("/api/notifications", notificationsRoutes);
  app.route("/api/users", usersRoutes);

  // Anything not matched above is a frontend route — hand it to the asset
  // binding, which serves real files or falls back to index.html (SPA mode).
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  app.onError(errorHandler);
  return app;
}
