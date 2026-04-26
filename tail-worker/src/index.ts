// Forwards exceptions / error logs to a Telegram debug chat via the Bot API.

interface Env {
  BOT_TOKEN: string;
  DEBUG_CHAT_ID: string;
  SOURCE_NAME: string;
}

type TailLog = { message: unknown; level: string; timestamp: number };
type TailException = { name: string; message: string; timestamp: number };
type TailItem = {
  scriptName?: string;
  outcome?: string;
  exceptions?: TailException[];
  logs?: TailLog[];
  eventTimestamp?: number;
};

export default {
  async tail(events: TailItem[], env: Env, _ctx: ExecutionContext): Promise<void> {
    const lines: string[] = [];
    for (const e of events) {
      for (const ex of e.exceptions ?? []) {
        lines.push(`💥 ${ex.name}: ${ex.message}`);
      }
      for (const log of e.logs ?? []) {
        if (log.level !== "error") continue;
        lines.push(`❌ ${formatLogMessage(log.message)}`);
      }
      if (e.outcome && e.outcome !== "ok") {
        lines.push(`⚠️  outcome=${e.outcome}`);
      }
    }
    if (lines.length === 0) return;

    const text = `🚨 <b>${escapeHtml(env.SOURCE_NAME)}</b>\n<pre>${escapeHtml(
      lines.join("\n"),
    ).slice(0, 3500)}</pre>`;
    await sendTelegram(env, text);
  },
};

function formatLogMessage(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map((m) => (typeof m === "string" ? m : JSON.stringify(m))).join(" ");
  }
  if (typeof message === "string") return message;
  return JSON.stringify(message);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(env: Env, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.DEBUG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_notification: true,
    }),
  });
  if (!res.ok) {
    // Don't throw: tail exceptions would feed back into the tail handler.
    console.error("tail-worker send failed", {
      status: res.status,
      body: await res.text(),
    });
  }
}
