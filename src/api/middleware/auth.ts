import { createMiddleware } from "hono/factory";
import { verifyInitData, type TelegramUser } from "../../telegram/auth";
import { getUser, type User } from "../../db/users";
import { UnauthorizedError } from "../../lib/errors";
import type { Env } from "../../env";

export type AuthVars = { tgUser: TelegramUser; user: User };

// Verifies the Telegram Mini App initData header and loads the corresponding
// user row. Users must have run /start at least once — that's where the row is
// created. We intentionally don't auto-create here so we never lose a group's
// chat_id by overwriting it with a Mini App private-chat session.
export const requireMiniAppUser = createMiddleware<{
  Bindings: Env;
  Variables: AuthVars;
}>(async (c, next) => {
  const auth = c.req.header("authorization") ?? "";
  const match = auth.match(/^tma (.+)$/i);
  if (!match) throw new UnauthorizedError();

  const tg = await verifyInitData(match[1]!, c.env);
  if (!tg) throw new UnauthorizedError();

  const user = await getUser(c.env, tg.id);
  if (!user) throw new UnauthorizedError("send /start to the bot first");

  c.set("tgUser", tg);
  c.set("user", user);
  await next();
});
