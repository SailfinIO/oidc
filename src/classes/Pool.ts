/**
 * @fileoverview Implementation of a generic connection pool for managing reusable resources.
 * This file exports the `Pool` class, which provides an efficient way to manage a pool
 * of resources, such as database connections, worker threads, or network sockets.
 *
 * @remarks
 * The `Pool` class implements the `IPool` interface and extends Node.js's EventEmitter,
 * providing event-driven resource management. It enforces constraints like maximum pool size,
 * acquire timeouts, idle resource cleanup, and resource validation.
 *
 * Key features include:
 * - Support for custom resource factories through the `IFactory` interface.
 * - Configurable pool options (e.g., size, timeouts, validation).
 * - Event notifications for resource lifecycle events.
 * - Graceful draining and cleanup mechanisms.
 *
 * @exports
 * @class Pool<T> - The main connection pool class.
 *
 * @requires
 * - `events`: For event-driven programming.
 * - `../errors`: Custom error types specific to pool operations.
 * - `../interfaces/factory.interface`: Interface for custom resource factories.
 * - `../interfaces/pool.interface`: Interface for pool and resource types.
 * - `../interfaces/logger.interface`: Interface for the logger used by the pool.
 * - `../constants/pool-options.constants`: Default pool configuration options.
 * - `../utils/Logger`: Utility class for logging pool events.
 *
 * @see {@link https://nodejs.org/api/events.html | Node.js EventEmitter documentation}
 * @see {@link IPool} for the interface definition.
 * @see {@link IFactory} for resource factory definitions.
 *
 * @example
 * ```typescript
 * // Example of using the Pool class
 * const factory: IFactory<MyResource> = {
 *   create: async () => new MyResource(),
 *   destroy: async (resource) => resource.cleanup(),
 * };
 *
 * const pool = await Pool.initialize(factory, { minPoolSize: 5, maxPoolSize: 10 });
 * const resource = await pool.acquire();
 * await pool.release(resource);
 * ```
 *
 * @version 0.0.1
 * @since 0.0.1
 * @public
 */

import { EventEmitter } from 'events';
import {
  PoolAcquireTimeoutError,
  PoolCreateResourceError,
  PoolDestroyError,
  PoolDrainingError,
  PoolError,
  PoolMaxWaitingClientsError,
  PoolReleaseError,
  PoolResourceNotFoundError,
} from '../errors';
import { IFactory } from '../interfaces/IFactory';
import { IPool, IPoolOptions, IPoolResource } from '../interfaces/IPool';
import { DEFAULT_POOL_OPTIONS } from '../constants/pool-options.constants';
import { ILogger } from '../interfaces';
import { Logger } from '../utils/Logger';

interface WaitingClient<T> {
  resolve: (resource: T) => void;
  reject: (error: any) => void;
  timeout: NodeJS.Timeout;
}

/**
 * A generic connection pool implementation for managing reusable resources.
 * It minimizes resource creation overhead and ensures efficient utilization
 * by limiting the number of simultaneous resource instances.
 *
 * @remarks
 * This class supports event-based notifications for resource lifecycle events
 * and enforces pool constraints such as max size, idle timeout, and acquire timeouts.
 *
 * @template T The type of the resource.
 * @implements {IPool}
 * @extends EventEmitter
 * @class
 * @fires acquire When a resource is acquired.
 * @fires release When a resource is released back to the pool.
 * @fires destroy When a resource is destroyed.
 * @fires drain When the pool is drained.
 * @fires clear When the pool is cleared.
 * @fires createSuccess When a resource is created successfully.
 * @fires createError When an error occurs during resource creation.
 * @see {@link IPool} for the interface implemented by this class.
 * @see {@link ILogger} for the logger interface used by the pool.
 * @see {@link IFactory} for the resource factory interface.
 * @see {@link PoolError} for the base error class used by the pool.
 * @see https://nodejs.org/api/events.html#events_class_eventemitter Node.js EventEmitter documentation.
 * @export
 * @public
 * @final
 * @since 0.0.1
 * @version 0.0.1
 * @example
 * ```typescript
 * const pool = await Pool.initialize(myFactory, { minPoolSize: 5 });
 * const resource = await pool.acquire();
 * await pool.release(resource);
 * ```
 */
export class Pool<T> extends EventEmitter implements IPool<T> {
  private static readonly DEFAULT_POOL_OPTIONS = DEFAULT_POOL_OPTIONS;
  private readonly logger: ILogger;
  private readonly factory: IFactory<T>;
  private readonly options: IPoolOptions;
  private resources: IPoolResource<T>[] = [];
  private waitingClients: WaitingClient<T>[] = [];
  private draining: boolean = false;
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private isLocked: boolean = false;
  private lockQueue: Array<() => void> = [];

  constructor(factory: IFactory<T>, options: IPoolOptions, logger?: ILogger) {
    super();
    this.factory = factory;
    this.options = { ...Pool.DEFAULT_POOL_OPTIONS, ...options };
    this.logger = logger || new Logger(Pool.name, this.options.logLevel, true);

    // Set up periodic idle checks
    if (this.options.idleCheckIntervalMillis !== undefined) {
      this.idleCheckInterval = setInterval(() => {
        this.checkIdleResources();
      }, this.options.idleCheckIntervalMillis);
    }

    this.logger.info('Pool initialized', this.options);
  }

  /**
   * Initializes a new pool with the specified factory and options,
   * ensuring the minimum pool size is populated.
   *
   * @template T The type of the resource.
   * @async
   * @param {IFactory<T>} factory The factory responsible for creating and destroying resources.
   * @param {IPoolOptions} options Configuration options for the pool, such as size and timeouts.
   * @returns {Promise<Pool<T>>} A promise that resolves with the initialized pool instance.
   *
   * @remarks
   * This method is ideal for setting up a pool when the minimum size must be populated
   * before the pool is ready to serve requests.
   *
   * @see {@link IFactory} for details about the resource factory interface.
   * @see {@link PoolOptions} for a description of pool configuration options.
   * @since 0.0.1
   * @version 0.0.1
   * @example
   * ```typescript
   * const pool = await Pool.initialize(factory, { minPoolSize: 5 });
   * ```
   */
  static async initialize<T>(
    factory: IFactory<T>,
    options: IPoolOptions,
  ): Promise<Pool<T>> {
    const pool = new Pool(factory, options);
    pool.logger.debug('Initializing pool with factory and options');
    await pool.populateInitialResources();
    return pool;
  }

  /**
   * Populate the pool with the minimum number of resources.
   * @private
   * @since 0.0.1
   * @version 0.0.1
   * @returns {Promise<void>}
   * @example
   * ```typescript
   * populateInitialResources();
   * ```
   */
  private async populateInitialResources(): Promise<void> {
    this.logger.debug('Populating initial resources for the pool');
    const promises = Array.from({ length: this.options.minPoolSize }, () =>
      this.createResource(),
    );
    await Promise.all(promises);
  }

  /**
   * Check for idle resources and destroy them if they exceed the idle timeout or max lifetime.
   * @private
   * @since 0.0.1
   * @version 0.0.1
   * @returns {void}
   * @example
   * ```typescript
   * checkIdleResources();
   * ```
   */
  private checkIdleResources(): void {
    const now = Date.now();
    this.resources.forEach((res) => {
      if (
        this.isResourceIdle(res, now) &&
        this.resources.length > this.options.minPoolSize
      ) {
        this.logger.debug('Destroying idle resource.');
        this.destroy(res.resource).catch((err) =>
          this.handleError('destroyError', err),
        );
      }
    });
    this.handleMinPoolSize();
  }

  private isResourceIdle(res: IPoolResource<T>, now: number): boolean {
    const exceededIdleTime =
      now - res.lastUsed > (this.options.idleTimeoutMillis || 30000);
    const exceededLifetime = this.options.maxLifetime
      ? now - res.createdAt > this.options.maxLifetime
      : false;
    return !res.inUse && (exceededIdleTime || exceededLifetime);
  }

  private handleError(event: string, error: Error): void {
    this.logger.error(`${event} occurred.`, { error });
    this.emit(event, error);
  }

  private async handleMinPoolSize(): Promise<void> {
    while (this.resources.length < this.options.minPoolSize) {
      await this.createResource();
    }
  }

  private getAvailableResource(): T | null {
    const res = this.resources.find((resource) => !resource.inUse);
    if (res) this.updateResourceState(res.resource, true);
    return res?.resource || null;
  }

  /**
   * Create a new resource and add it to the pool.
   * @private
   * @async
   * @since 0.0.1
   * @version 0.0.1
   * @returns {Promise<void>}
   * @throws {PoolCreateResourceError} Throws an error if the resource creation fails.
   * @example
   * ```typescript
   * createResource();
   * ```
   */
  private async createResource(): Promise<void> {
    if (this.resources.length >= this.options.maxPoolSize) {
      this.logger.warn('Cannot create resource: max pool size reached.');
      return;
    }

    try {
      const resource = await this.factory.create();
      this.resources.push({
        resource,
        inUse: false,
        lastUsed: Date.now(),
        createdAt: Date.now(),
      });
      this.logger.info('Resource created successfully.', {
        resourceCount: this.resources.length,
        maxPoolSize: this.options.maxPoolSize,
      });
      this.emit('createSuccess', resource);
      this.checkWaitingClients();
    } catch (error) {
      this.logger.error('Failed to create resource.', { error });
      this.emit('createError', error);

      // Reject the first waiting client if any
      const client = this.waitingClients.shift();
      if (client) {
        clearTimeout(client.timeout);
        client.reject(new PoolCreateResourceError(error));
      }
    }
  }
  /**
   * Check for waiting clients and assign them a resource if available.
   * Also handles creating new resources if the pool has capacity.
   *
   * @remarks This method is called whenever a resource is released or destroyed. It ensures that
   * waiting clients are assigned resources and that the pool maintains its size constraints. If a fatal
   * error occurs during this process, all waiting clients are rejected with an error.
   *
   * @private
   * @async
   * @since 0.0.1
   * @version 0.0.1
   * @returns {Promise<void>}
   * @throws {PoolError} Throws an error if a fatal error occurs during the process.
   * @example
   * ```typescript
   * await checkWaitingClients();
   * ```
   */
  private async checkWaitingClients(): Promise<void> {
    if (this.waitingClients.length === 0) {
      this.logger.debug('No waiting clients to process.');
      return;
    }

    const promises: Promise<void>[] = [];

    try {
      this.logger.debug('Checking waiting clients.', {
        waitingClientsCount: this.waitingClients.length,
        availableResourcesCount: this.resources.filter((res) => !res.inUse)
          .length,
      });

      // Assign available resources to waiting clients
      for (const res of this.resources) {
        if (!res.inUse && this.waitingClients.length > 0) {
          const client = this.waitingClients.shift();
          if (client) {
            try {
              res.inUse = true;
              clearTimeout(client.timeout);
              client.resolve(res.resource);
              this.logger.info('Assigned resource to waiting client.', {
                resourceId: res.resource,
              });
              this.emit('acquire', res.resource);
            } catch (resolveError) {
              this.logger.error('Failed to assign resource to client.', {
                resourceId: res.resource,
                error: resolveError,
              });
              this.emit('assignError', resolveError);
              client.reject(resolveError);
            }
          }
        }
      }

      // Create new resources if the pool has capacity
      while (
        this.resources.length + promises.length < this.options.maxPoolSize &&
        this.waitingClients.length > 0
      ) {
        this.logger.debug('Creating new resource for waiting clients.', {
          currentPoolSize: this.resources.length,
          maxPoolSize: this.options.maxPoolSize,
        });

        promises.push(
          this.createResource().catch((createError) => {
            this.logger.error('Failed to create resource for waiting client.', {
              error: createError,
            });
            this.emit('createError', createError);

            // Reject the first waiting client if creation fails
            const client = this.waitingClients.shift();
            if (client) {
              clearTimeout(client.timeout);
              client.reject(new PoolCreateResourceError(createError));
            }
          }),
        );
      }

      // Wait for all resource creation promises to settle
      await Promise.allSettled(promises);
    } catch (error) {
      this.logger.error(
        'Fatal error occurred while checking waiting clients.',
        {
          error,
        },
      );
      this.emit('checkClientsError', error);

      // Reject all waiting clients if a fatal error occurs
      this.waitingClients.forEach((client) => {
        clearTimeout(client.timeout);
        client.reject(
          new PoolError(
            'Unexpected error in checkWaitingClients',
            'POOL_CHECK_ERROR',
          ),
        );
      });
      this.waitingClients = [];
    }
  }

  private handleAndEmitError(event: string, error: Error): void {
    this.logger.error(`${event} occurred.`, { error });
    this.emit(event, error);
  }

  private async acquireLock(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isLocked) {
        this.isLocked = true;
        resolve();
      } else {
        this.lockQueue.push(resolve);
      }
    });
  }

  private releaseLock(): void {
    if (this.lockQueue.length > 0) {
      const resolve = this.lockQueue.shift();
      if (resolve) resolve();
    } else {
      this.isLocked = false;
    }
  }

  private async synchronized<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Acquires a resource from the pool, creating a new one if necessary
   * and within the pool size limits.
   *
   * @remarks This method is used to acquire a resource from the pool. If a resource is available, it is marked as in use and returned to the client. If no resources are available, the method checks if a new resource can be created based on the pool size limits. If the pool is at capacity, the method checks if the maximum number of waiting clients has been reached. If the pool is draining, the method rejects the request. If the operation times out before a resource becomes available, the method rejects the request with a timeout error.
   *
   * @returns {Promise<T>} A promise that resolves with the acquired resource.
   * @throws {PoolDrainingError} Throws if the pool is in the process of draining.
   * @throws {PoolCreateResourceError} Throws if a new resource cannot be created.
   * @throws {PoolAcquireTimeoutError} Throws if the operation times out before a resource becomes available.
   * @throws {PoolMaxWaitingClientsError} Throws if the maximum number of waiting clients is exceeded.
   * @throws {Error} Throws if resource validation fails.
   * @fires acquire When a resource is successfully acquired.
   * @async
   * @public
   * @since 0.0.1
   * @version 0.0.1
   * @see {@link PoolDrainingError} for details on the draining error.
   * @see {@link PoolCreateResourceError} for details on resource creation errors.
   * @example
   * ```typescript
   * const resource = await pool.acquire();
   * ```
   */
  public async acquire(): Promise<T> {
    return this.synchronized(async () => {
      if (this.draining) {
        this.logger.warn('Cannot acquire resource: pool is draining.');
        throw new PoolDrainingError();
      }

      const availableResource = this.getAvailableResource();
      if (availableResource) {
        return availableResource;
      }

      const canCreateNewResource =
        this.resources.length < this.options.maxPoolSize;
      const canAddToWaitingQueue =
        this.options.maxWaitingClients === undefined ||
        this.waitingClients.length < this.options.maxWaitingClients;

      if (canCreateNewResource && canAddToWaitingQueue) {
        this.logger.debug(
          'No available resource; adding to waiting queue and creating a new resource.',
          {
            currentPoolSize: this.resources.length,
            maxPoolSize: this.options.maxPoolSize,
            waitingClientsCount: this.waitingClients.length,
            maxWaitingClients: this.options.maxWaitingClients,
          },
        );

        return new Promise<T>((resolve, reject) => {
          this.addWaitingClient(resolve, reject);
          this.createResource();
        });
      } else if (canAddToWaitingQueue) {
        this.logger.debug(
          'Adding client to waiting queue without creating new resource.',
          {
            waitingClientsCount: this.waitingClients.length,
            maxWaitingClients: this.options.maxWaitingClients,
          },
        );

        return new Promise<T>((resolve, reject) => {
          this.addWaitingClient(resolve, reject);
        });
      } else {
        this.logger.error(
          'Max waiting clients limit exceeded; rejecting acquire request.',
          {
            maxWaitingClients: this.options.maxWaitingClients,
            waitingClientsCount: this.waitingClients.length,
          },
        );
        throw new PoolMaxWaitingClientsError();
      }
    });
  }

  /**
   * Releases a resource back into the pool for reuse. If the resource is invalid or the pool is draining, it will be destroyed.
   *
   * @remarks This method is used to release a resource back into the pool. If the pool is draining, the resource is destroyed instead of being released. If the resource fails validation, it is also destroyed. If the pool is below the minimum size, a new resource is created to maintain the minimum pool size. After releasing the resource, the method checks for waiting clients and assigns them resources if available.
   *
   * @param {T} resource The resource to be released back to the pool.
   * @returns {Promise<void>} A promise that resolves once the resource has been successfully released.
   * @throws {PoolResourceNotFoundError} Throws if the resource is not part of the pool.
   * @throws {PoolReleaseError} Throws if resource validation fails during the release process.
   * @fires release When a resource is successfully released.
   * @async
   * @public
   * @since 0.0.1
   * @version 0.0.1
   * @example
   * ```typescript
   * await pool.release(resource);
   * ```
   */
  public async release(resource: T): Promise<void> {
    this.logger.debug('Releasing resource.', { resource });

    if (this.draining) {
      this.logger.warn(
        'Pool is draining. Destroying resource instead of releasing.',
        { resource },
      );
      await this.destroy(resource);
      return;
    }

    const poolResource = this.resources.find(
      (res) => res.resource === resource,
    );
    if (!poolResource) {
      const error = new PoolResourceNotFoundError();
      this.emitError('releaseError', error);
      throw error;
    }

    if (!(await this.validateResource(resource))) {
      await this.destroy(resource);
      await this.maintainMinPoolSize();
      return;
    }

    this.updateResourceState(resource, false);
    this.logger.info('Resource released successfully.', { resource });
    this.emit('release', resource);
    this.checkWaitingClients();
  }

  private emitError(event: string, error: any): void {
    this.logger.error(`${event} occurred.`, { error });
    this.emit(event, error);
  }

  private async validateResource(resource: T): Promise<boolean> {
    if (typeof this.factory.validate === 'function') {
      try {
        return await this.factory.validate(resource);
      } catch (error) {
        this.logger.error('Error occurred during resource validation.', {
          resource,
          error,
        });
        throw new PoolReleaseError('Resource validation failed.');
      }
    }
    return true; // Default to valid if no validate function is provided
  }

  private async maintainMinPoolSize(): Promise<void> {
    while (this.resources.length < this.options.minPoolSize) {
      await this.createResource();
    }
  }

  private updateResourceState(resource: T, inUse: boolean): void {
    const poolResource = this.resources.find(
      (res) => res.resource === resource,
    );
    if (poolResource) {
      poolResource.inUse = inUse;
      poolResource.lastUsed = Date.now();
    }
  }

  private addWaitingClient(
    resolve: (resource: T) => void,
    reject: (error: any) => void,
  ): void {
    const timeout = setTimeout(() => {
      const index = this.waitingClients.findIndex((c) => c.timeout === timeout);
      if (index !== -1) {
        const client = this.waitingClients.splice(index, 1)[0];
        this.logger.error('Acquire timeout exceeded for waiting client.');
        client.reject(new PoolAcquireTimeoutError());
      }
    }, this.options.acquireTimeoutMillis || 30000);

    this.waitingClients.push({ resolve, reject, timeout });
  }

  /**
   * Drains the pool, destroying all resources and preventing new acquisitions.
   *
   * @remarks This method is used to drain the pool, destroying all resources and preventing new acquisitions. The pool is marked as draining, and the idle check interval is cleared. All resources are destroyed, and any waiting clients are rejected. After draining the pool, the method emits a `drain` event.
   *
   * @returns {Promise<void>} A promise that resolves once the pool is fully drained.
   * @throws {PoolError} Throws if an error occurs during the draining process.
   * @fires drain When the pool is successfully drained.
   * @async
   * @public
   * @since 0.0.1
   * @version 0.0.1
   * @see {@link clear} for clearing the pool during the draining process.
   * @see {@link PoolError} for the base error class.
   * @example
   * ```typescript
   * await pool.drain();
   * console.log('The pool has been drained.');
   * ```
   */
  public async drain(): Promise<void> {
    this.logger.info('Initiating pool draining process.');

    this.draining = true;

    try {
      if (this.idleCheckInterval) {
        this.logger.debug('Clearing idle check interval.');
        clearInterval(this.idleCheckInterval);
        this.idleCheckInterval = null;
      }

      this.logger.info('Clearing all resources in the pool.');
      await this.clear();

      this.logger.info('Pool drained successfully.');
      this.emit('drain');
    } catch (error) {
      this.logger.error('Failed to drain the pool.', { error });
      this.emit('drainError', error);
      throw new PoolError('Failed to drain the pool.', 'POOL_DRAIN_ERROR');
    }
  }

  /**
   * Clears the pool by destroying all resources and rejecting any pending clients.
   *
   * @remarks This method is used to clear the pool by destroying all resources and rejecting any pending clients. All resources are destroyed, and any waiting clients are rejected. After clearing the pool, the method emits a `clear` event.
   *
   * @returns {Promise<void>} A promise that resolves once all resources are destroyed.
   * @throws {PoolError} Throws if an error occurs during the clearing process.
   * @fires clear When the pool is successfully cleared.
   * @public
   * @async
   * @since 0.0.1
   * @version 0.0.1
   * @example
   * ```typescript
   * await pool.clear();
   * ```
   */
  public async clear(): Promise<void> {
    this.logger.info('Initiating pool clearing process.');

    try {
      this.logger.debug('Destroying all resources in the pool.', {
        resourceCount: this.resources.length,
      });

      const destroyPromises = this.resources.map((res) =>
        this.factory.destroy(res.resource),
      );
      await Promise.all(destroyPromises);

      this.logger.info('All resources destroyed successfully.');

      this.resources = [];

      if (this.waitingClients.length > 0) {
        this.logger.debug('Rejecting all waiting clients.', {
          waitingClientsCount: this.waitingClients.length,
        });

        this.waitingClients.forEach((client) => {
          clearTimeout(client.timeout);
          client.reject(
            new PoolError('Pool is being cleared.', 'POOL_CLEARED'),
          );
        });

        this.logger.info('All waiting clients have been rejected.');
      }

      this.waitingClients = [];
      this.logger.info('Pool clearing process completed.');
      this.emit('clear');
    } catch (error) {
      this.logger.error('Failed to clear the pool.', { error });
      this.emit('clearError', error);
      throw new PoolError('Failed to clear the pool.', 'POOL_CLEAR_ERROR');
    }
  }

  /**
   * Destroy a resource and remove it from the pool.
   *
   * @remarks This method is used to destroy a resource and remove it from the pool. The resource is removed from the pool, destroyed, and an event is emitted. If the pool is below the minimum size, a new resource is created to maintain the minimum pool size. After destroying the resource, the method checks for waiting clients and assigns them resources if available.
   *
   * @param {T} resource The resource to destroy.
   * @returns {Promise<void>}
   * @throws {PoolDestroyError} Throws an error if the resource destruction fails.
   * @protected
   * @since 0.0.1
   * @version 0.0.1
   * @example
   * ```typescript
   * pool.destroy(resource).then(() => {
   *  console.log('Resource destroyed.');
   * });
   * ```
   */
  protected async destroy(resource: T): Promise<void> {
    this.logger.info('Initiating destruction of a resource.', { resource });

    try {
      this.logger.debug('Removing resource from the pool.', {
        resourceCountBefore: this.resources.length,
      });

      this.resources = this.resources.filter(
        (res) => res.resource !== resource,
      );

      this.logger.debug('Resource removed from the pool.', {
        resourceCountAfter: this.resources.length,
      });

      await this.factory.destroy(resource);
      this.logger.info('Resource destroyed successfully.', { resource });
      this.emit('destroy', resource);

      // Ensure minPoolSize is maintained
      if (!this.draining && this.resources.length < this.options.minPoolSize) {
        this.logger.info(
          'Pool size below minimum. Creating new resource to maintain minPoolSize.',
          {
            currentPoolSize: this.resources.length,
            minPoolSize: this.options.minPoolSize,
          },
        );

        this.createResource().catch((err) => {
          this.logger.error(
            'Failed to create resource while maintaining minPoolSize.',
            { error: err },
          );
          this.emit('createError', err);
        });
      }
    } catch (error) {
      this.logger.error('Failed to destroy resource.', { resource, error });
      this.emit('destroyError', error);
      throw new PoolDestroyError(error);
    }

    this.logger.debug('Checking waiting clients after resource destruction.');
    this.checkWaitingClients();
  }
}
