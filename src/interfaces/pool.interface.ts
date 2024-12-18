// src/interfaces/pool.interface.ts

import { LogLevel } from 'src/enums';

export interface IPoolResource<T> {
  resource: T; // The resource
  inUse: boolean; // Whether the resource is in use
  lastUsed: number; // The last time the resource was used
  createdAt: number; // The time the resource was created
}

export interface IPool<T> {
  acquire(): Promise<T>; // Acquire a resource
  release(resource: T): void; // Release a resource
  drain(): Promise<void>; // Drain the pool
  clear(): Promise<void>; // Clear the pool
}

export interface IPoolOptions {
  maxPoolSize: number; // Maximum number of connections
  minPoolSize: number; // Minimum number of connections
  acquireTimeoutMillis?: number; // Timeout for acquiring a connection
  idleTimeoutMillis?: number; // Timeout for idle connections
  maxLifetime?: number; // Maximum lifetime of a connection
  validationFunction?: (resource: any) => Promise<boolean>; // Function to validate resources before reuse
  maxWaitingClients?: number; // Maximum number of clients waiting for a connection
  idleCheckIntervalMillis?: number; // Interval for checking idle resources
  logLevel?: LogLevel;
}
