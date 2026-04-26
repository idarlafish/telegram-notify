import type { Env } from "../env";

type LogLevel = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields?: Fields): void {
  console.log(JSON.stringify({ level, message, ts: Date.now(), ...fields }));
}

// Maps a `Fields` record to the Analytics Engine triplet:
//   - numeric fields  → `doubles`
//   - string  fields  → `blobs` (so they're queryable as labels)
//   - a field named `id`, if string, doubles as the analytics `index`
//     (used for sampled queries on high-cardinality dimensions).
// Everything else (booleans, nested objects) is omitted from the analytics
// payload — those still appear in the log line for ad-hoc debugging.
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
  // Structured event: written to both the log stream (for `wrangler tail` and
  // ad-hoc dashboard queries) AND the Analytics Engine dataset (for queryable
  // time-series via the GraphQL API). Single call site keeps the dimensions
  // in sync between the two sinks.
  event(env: Env, name: string, fields: Fields = {}): void {
    emit("info", name, fields);
    env.ANALYTICS.writeDataPoint(toDataPoint(name, fields));
  },
};
