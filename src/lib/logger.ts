type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, message, ts: Date.now(), ...fields }));
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
