import { webhookCallback } from "grammy";
import { handleApi } from "./api.ts";
import { createBot } from "./bot.ts";
import { registerCommands } from "./commands.ts";
import { fireDueNotifications } from "./scheduler.ts";
import type { Env } from "./types.ts";

const cors = (extra: HeadersInit = {}): HeadersInit => ({
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  ...extra,
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    if (url.pathname === "/telegram-webhook" && request.method === "POST") {
      // Verify Telegram's secret-token header.
      const sec = request.headers.get("x-telegram-bot-api-secret-token");
      if (sec !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });

      const bot = createBot(env);
      registerCommands(bot, env);
      try {
        return await webhookCallback(bot, "cloudflare-mod")(request);
      } catch (e) {
        console.error("webhook error:", e);
        return new Response("OK", { status: 200 }); // never let Telegram retry-storm us
      }
    }

    if (url.pathname.startsWith("/api/")) {
      const res = await handleApi(request, env, url.pathname);
      // Add CORS headers.
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors())) headers.set(k, String(v));
      return new Response(res.body, { status: res.status, headers });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "content-type": "application/json", ...cors() },
      });
    }

    return new Response("not found", { status: 404, headers: cors() });
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await fireDueNotifications(env);
  },
};
