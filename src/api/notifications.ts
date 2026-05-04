import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { requireMiniAppUser, type AuthVars } from "./middleware/auth";
import { CreateNotificationSchema, UpdateNotificationSchema } from "./schemas";
import {
  createNotification,
  deleteNotification,
  listNotifications,
  updateNotification,
} from "../services/notifications";
import { NotFoundError } from "../lib/errors";
import type { Env } from "../env";

export const notificationsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>()
  .use("*", requireMiniAppUser)
  .get("/", async (c) => {
    const items = await listNotifications(c.env, c.get("tgUser").id);
    return c.json({ items });
  })
  .post("/", vValidator("json", CreateNotificationSchema), async (c) => {
    const input = c.req.valid("json");
    const notification = await createNotification(c.env, c.get("tgUser").id, input);
    return c.json({ notification }, 201);
  })
  .patch("/:id", vValidator("json", UpdateNotificationSchema), async (c) => {
    const id = c.req.param("id");
    const patch = c.req.valid("json");
    const updated = await updateNotification(c.env, c.get("tgUser").id, id, patch);
    if (!updated) throw new NotFoundError("notification not found");
    return c.json({ notification: updated });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await deleteNotification(c.env, c.get("tgUser").id, id);
    if (!ok) throw new NotFoundError("notification not found");
    return c.json({ ok: true });
  });
