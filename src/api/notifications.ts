import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import {
  createNotification, deleteNotification, listByUser, updateNotification,
} from "../db/notifications";
import { requireMiniAppUser, type AuthVars } from "./middleware/auth";
import { CreateNotificationSchema, UpdateNotificationSchema } from "./schemas";
import { NotFoundError } from "../lib/errors";
import type { Env } from "../env";

export const notificationsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>()
  .use("*", requireMiniAppUser)
  .get("/", async (c) => {
    const items = await listByUser(c.env, c.get("user").id);
    return c.json({ items });
  })
  .post("/", vValidator("json", CreateNotificationSchema), async (c) => {
    const input = c.req.valid("json");
    const notification = await createNotification(c.env, c.get("user").id, input);
    return c.json({ notification }, 201);
  })
  .patch("/:id", vValidator("json", UpdateNotificationSchema), async (c) => {
    const id = c.req.param("id");
    const patch = c.req.valid("json");
    const updated = await updateNotification(c.env, c.get("user").id, id, patch);
    if (!updated) throw new NotFoundError("notification not found");
    return c.json({ notification: updated });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await deleteNotification(c.env, c.get("user").id, id);
    if (!ok) throw new NotFoundError("notification not found");
    return c.json({ ok: true });
  });
