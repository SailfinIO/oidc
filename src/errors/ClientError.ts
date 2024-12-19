// src/errors/ClientError.ts

export class ClientError extends Error {
  public code: string;
  public context?: any;

  constructor(message: string, code: string = 'CLIENT_ERROR', context?: any) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
