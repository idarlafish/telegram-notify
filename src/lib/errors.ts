export const ErrorCode = {
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "not_found",
  VALIDATION: "validation_error",
  PAST_DATE: "past_date",
  CONFLICT: "conflict",
  INTERNAL: "internal",
} as const;

export type AppErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  constructor(code: AppErrorCode, message: string, status: number) {
    super(message);
    this.name = code;
    this.code = code;
    this.status = status;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "unauthorized") {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super(ErrorCode.NOT_FOUND, message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "validation failed") {
    super(ErrorCode.VALIDATION, message, 400);
  }
}

export class PastDateError extends AppError {
  constructor(message = "one-time reminder must be in the future") {
    super(ErrorCode.PAST_DATE, message, 400);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message, 409);
  }
}

export class InternalError extends AppError {
  constructor(message = "internal error") {
    super(ErrorCode.INTERNAL, message, 500);
  }
}
