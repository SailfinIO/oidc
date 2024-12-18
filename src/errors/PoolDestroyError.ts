// src/errors/PoolDestroyError.ts

import { PoolError } from './PoolError';

export class PoolDestroyError extends PoolError {
  constructor(originalError: Error) {
    super(`Failed to destroy: ${originalError.message}`, 'POOL_DESTROY');
    this.stack = originalError.stack;
  }
}
