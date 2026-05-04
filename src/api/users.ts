import { Hono } from "hono";
import { requireMiniAppUser, type AuthVars } from "./middleware/auth";
import { destroyUser } from "../services/user";
import type { Env } from "../env";

export const usersRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>()
  .use("*", requireMiniAppUser)
  .get("/me", (c) => c.json({ profile: c.get("profile") }))
  .delete("/me", async (c) => {
    await destroyUser(c.env, c.get("tgUser").id);
    return c.json({ ok: true });
  });
