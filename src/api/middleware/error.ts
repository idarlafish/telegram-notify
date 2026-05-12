import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError, ErrorCode } from "../../lib/errors";
import { logger } from "../../lib/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error("server error", { error: err.message, code: err.code });
      return c.json(
        { error: ErrorCode.INTERNAL, message: "internal error" },
        err.status as ContentfulStatusCode,
      );
    }
    return c.json({ error: err.code, message: err.message }, err.status as ContentfulStatusCode);
  }
  logger.error("unhandled error", {
    error: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ error: ErrorCode.INTERNAL, message: "internal error" }, 500);
};
