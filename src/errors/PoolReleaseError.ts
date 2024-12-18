// src/errors/PoolReleaseError.ts

import { PoolError } from './PoolError';

export class PoolReleaseError extends PoolError {
  constructor(message: string) {
    super(message, 'POOL_RELEASE_ERROR');
  }
}
