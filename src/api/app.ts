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

  app.all("*", (c) => c.text("Not found", 404));

  app.onError(errorHandler);
  return app;
}
