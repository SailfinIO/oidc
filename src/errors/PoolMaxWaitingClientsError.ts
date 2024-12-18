// src/errors/PoolMaxWaitingClientsError.ts

import { PoolError } from './PoolError';

export class PoolMaxWaitingClientsError extends PoolError {
  constructor() {
    super(
      'No available resources and max waiting clients reached.',
      'POOL_MAX_WAITING_CLIENTS',
    );
  }
}
