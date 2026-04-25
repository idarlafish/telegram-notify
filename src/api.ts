// Mini App REST API. Authenticated by Telegram initData in the
// `Authorization: tma <initData>` header (the standard pattern from
// telegram-web-app SDK).

import { verifyInitData, type TelegramUser } from "./auth.ts";
import {
  createNotification,
  deleteNotification,
  listNotifications,
} from "./db.ts";
import type { Env, NotificationInput } from "./types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function authenticate(req: Request, env: Env): Promise<TelegramUser | null> {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^tma (.+)$/i);
  if (!match) return null;
  return verifyInitData(match[1]!, env);
}

export async function handleApi(
  req: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const user = await authenticate(req, env);
  if (!user) return json({ error: "unauthorized" }, 401);

  // GET /api/notifications  — list user's notifications
  if (pathname === "/api/notifications" && req.method === "GET") {
    const items = await listNotifications(env, user.id);
    return json({ items });
  }

  // POST /api/notifications — create one
  if (pathname === "/api/notifications" && req.method === "POST") {
    let body: NotificationInput;
    try {
      body = (await req.json()) as NotificationInput;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (
      !/^\d{2}:\d{2}$/.test(body.time) ||
      typeof body.timezone !== "string" ||
      typeof body.message !== "string" ||
      body.message.trim().length === 0
    ) {
      return json({ error: "invalid payload" }, 400);
    }
    try {
      const n = await createNotification(env, user.id, body);
      return json({ notification: n }, 201);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  }

  // DELETE /api/notifications/:id
  const delMatch = pathname.match(/^\/api\/notifications\/([^/]+)$/);
  if (delMatch && req.method === "DELETE") {
    const ok = await deleteNotification(env, user.id, delMatch[1]!);
    return ok ? json({ ok: true }) : json({ error: "not found" }, 404);
  }

  return json({ error: "not found" }, 404);
}
