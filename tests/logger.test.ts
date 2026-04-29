import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/lib/logger";

// Tail-worker filters by Cloudflare tail-event `log.level`, which reflects the
// console method we called — not a JSON field inside the payload. If
// logger.error routes through console.log, tail-worker drops it silently. This
// suite locks in the level → console-method mapping so that regression can't
// recur.

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("info uses console.log", () => {
    logger.info("hello", { a: 1 });
    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({ level: "info", message: "hello", a: 1 });
  });

  it("warn uses console.warn", () => {
    logger.warn("careful");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const payload = JSON.parse(warnSpy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({ level: "warn", message: "careful" });
  });

  it("error uses console.error — tail-worker filter depends on this", () => {
    logger.error("boom", { id: "abc" });
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    const payload = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(payload).toMatchObject({ level: "error", message: "boom", id: "abc" });
  });
});
