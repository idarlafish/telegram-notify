import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import { requireMiniAppUser, type AuthVars } from "./middleware/auth";
import { CreateNotificationSchema, UpdateNotificationSchema } from "./schemas";
import { userDoStub } from "../scheduler/user-do/stub";
import { NotFoundError } from "../lib/errors";
import type { Env } from "../env";

export const notificationsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>()
  .use("*", requireMiniAppUser)
  .get("/", async (c) => {
    const items = await userDoStub(c.env, c.get("tgUser").id).list();
    return c.json({ items });
  })
  .post("/", vValidator("json", CreateNotificationSchema), async (c) => {
    const input = c.req.valid("json");
    const notification = await userDoStub(c.env, c.get("tgUser").id).create(input);
    return c.json({ notification }, 201);
  })
  .patch("/:id", vValidator("json", UpdateNotificationSchema), async (c) => {
    const id = c.req.param("id");
    const patch = c.req.valid("json");
    const updated = await userDoStub(c.env, c.get("tgUser").id).update(id, patch);
    if (!updated) throw new NotFoundError("notification not found");
    return c.json({ notification: updated });
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await userDoStub(c.env, c.get("tgUser").id).delete(id);
    if (!ok) throw new NotFoundError("notification not found");
    return c.json({ ok: true });
  });
