import { createMiddleware } from "hono/factory";
import { verifyInitData, type TelegramUser } from "../../telegram/auth";
import { getProfile } from "../../services/user";
import { UnauthorizedError } from "../../lib/errors";
import type { Profile } from "../../scheduler/user-do/types";
import type { Env } from "../../env";

export type AuthVars = { tgUser: TelegramUser; profile: Profile };

export const requireMiniAppUser = createMiddleware<{
  Bindings: Env;
  Variables: AuthVars;
}>(async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const match = auth.match(/^tma (.+)$/i);
  if (!match) throw new UnauthorizedError();

  const tg = await verifyInitData(match[1]!, c.env);
  if (!tg) throw new UnauthorizedError();

  const profile = await getProfile(c.env, tg.id);
  if (!profile) throw new UnauthorizedError("send /start to the bot first");

  c.set("tgUser", tg);
  c.set("profile", profile);
  await next();
});
