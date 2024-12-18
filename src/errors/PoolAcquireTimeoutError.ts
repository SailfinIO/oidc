// src/errors/PoolAcquireTimeoutError.ts

import { PoolError } from './PoolError';

export class PoolAcquireTimeoutError extends PoolError {
  constructor() {
    super('Acquire timeout.', 'POOL_ACQUIRE_TIMEOUT');
  }
}
