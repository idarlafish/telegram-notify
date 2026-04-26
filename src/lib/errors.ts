// Typed errors thrown from any layer. The Hono error middleware maps them to
// JSON responses. Keep status as a plain number — the cast to Hono's
// ContentfulStatusCode lives at the boundary, not here.
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "unauthorized") {
    super("unauthorized", message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super("not_found", message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "validation failed") {
    super("validation_error", message, 400);
  }
}

export class PastDateError extends AppError {
  constructor(message = "one-time reminder must be in the future") {
    super("past_date", message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409);
  }
}
