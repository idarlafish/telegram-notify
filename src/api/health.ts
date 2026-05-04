import { Hono } from "hono";
import type { Env } from "../env";

export const healthRoutes = new Hono<{ Bindings: Env }>()
  .get("/", (c) => c.json({ status: "ok" }));
