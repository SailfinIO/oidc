// src/errors/PoolResourceNotFoundError.ts

import { PoolError } from './PoolError';

export class PoolResourceNotFoundError extends PoolError {
  constructor() {
    super('Resource does not belong to the pool.', 'POOL_RESOURCE_NOT_FOUND');
  }
}
