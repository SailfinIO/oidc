// src/constants/pool-options.constants.ts

import { LogLevel } from '../enums';
import { IPoolOptions } from '../interfaces';

export const DEFAULT_POOL_OPTIONS: IPoolOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxWaitingClients: 10,
  idleCheckIntervalMillis: 30000,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  maxLifetime: 30000,
  logLevel: LogLevel.INFO,
};
