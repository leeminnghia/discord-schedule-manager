export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'ERR_APP_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'ERR_VALIDATION', 400);
  }
}

export class ConflictError extends AppError {
  public readonly conflictDetails?: any;

  constructor(message: string, conflictDetails?: any) {
    super(message, 'ERR_CONFLICT', 409);
    this.conflictDetails = conflictDetails;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 'ERR_NOT_FOUND', 404);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = 'Bạn không có quyền thực hiện hành động này.') {
    super(message, 'ERR_PERMISSION_DENIED', 403);
  }
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
}
