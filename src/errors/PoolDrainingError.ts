// src/errors/PoolDrainingError.ts

import { PoolError } from './PoolError';

export class PoolDrainingError extends PoolError {
  constructor() {
    super('Pool is draining, cannot acquire new resources.', 'POOL_DRAINING');
  }
}
