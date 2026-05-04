import type { Env } from "../env";

type LogLevel = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields?: Fields): void {
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify({ level, message, ts: Date.now(), ...fields }));
}

// Convention: numbers → doubles, strings → blobs, `id` → index.
function toDataPoint(name: string, fields: Fields): AnalyticsEngineDataPoint {
  const blobs: string[] = [name];
  const doubles: number[] = [];
  const indexes: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "number" && Number.isFinite(v)) doubles.push(v);
    else if (typeof v === "string") {
      if (k === "id") indexes.push(v);
      else blobs.push(v);
    }
  }
  return { blobs, doubles, indexes };
}

export const logger = {
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
  // Writes to both the log stream and the Analytics Engine dataset.
  event(env: Env, name: string, fields: Fields = {}): void {
    emit("info", name, fields);
    env.ANALYTICS.writeDataPoint(toDataPoint(name, fields));
  },
};
