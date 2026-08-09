export class AppError extends Error {
  constructor(status, code, details) {
    super(code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, AppError);
  }
}
