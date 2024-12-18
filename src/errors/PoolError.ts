// src/errors/PoolError.ts

export class PoolError extends Error {
  public code: string;

  constructor(message: string, code: string = 'POOL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
