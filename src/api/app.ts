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
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.post("/telegram-webhook", (c) => handleTelegramWebhook(c.req.raw, c.env));
  app.route("/api/notifications", notificationsRoutes);

  app.onError(errorHandler);
  return app;
}
