import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: err.code, message: err.message },
      err.status as ContentfulStatusCode,
    );
  }
  logger.error("unhandled error", {
    error: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ error: "internal", message: "internal error" }, 500);
};
