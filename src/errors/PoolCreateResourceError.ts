// src/errors/PoolCreateResourceError.ts

import { PoolError } from './PoolError';

export class PoolCreateResourceError extends PoolError {
  constructor(originalError: Error) {
    super(
      `Failed to create a new resource: ${originalError.message}`,
      'POOL_CREATE_RESOURCE',
    );
    this.stack = originalError.stack;
  }
}
