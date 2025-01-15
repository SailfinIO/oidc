/**
 * @fileoverview
 * Implements the `Mutex` class, a utility for controlling access to asynchronous resources.
 * The mutex ensures mutual exclusion by allowing only one execution thread to acquire the lock
 * at a time. It supports timeouts, queueing, and error handling.
 *
 * @module src/utils/Mutex
 */

import {
  ILogger,
  IMutex,
  MutexOptions,
  QueueEntry,
  ITimer,
  TimerId,
  MutexOperation,
  BackoffOptions,
  SchedulingStrategy,
  MutexState,
} from '../interfaces';
import { MutexError, ClientError } from '../errors';
import EventEmitter from 'events';
import { defaultMutexOptions } from '../constants/defaultMutexOptions';
import { MaxHeap } from '../utils/MaxHeap';

/**
 * Represents a mutex (mutual exclusion) utility for controlling access to asynchronous resources.
 *
 * The `Mutex` class provides a thread-safe mechanism for exclusive access, with support for queueing,
 * timeouts, and structured logging.
 *
 * @class
 * @implements {IMutex}
 */
export class Mutex<MutexOwner = unknown>
  extends EventEmitter
  implements IMutex<MutexOwner>
{
  private readonly _queue: QueueEntry<MutexOwner>[] = [];
  private readonly timer: ITimer;
  private readonly logger: ILogger;
  private readonly options: MutexOptions;
  private _locked: boolean = false;
  private _owner: MutexOwner | null = null;
  private _reentrantCount: number = 0;
  private readerCount: number = 0;
  private writerActive: boolean = false;
  private dependencyGraph = new Map<Mutex<any>, Set<any>>(); // Map from Mutex to set of waiting owners
  private ownerHolds = new Map<any, Set<Mutex<any>>>(); // Map from owner to set of held mutexes
  private _priorityQueue = new MaxHeap<QueueEntry<MutexOwner>>(
    (a, b) => a.priority - b.priority,
  );

  /**
   * Creates an instance of `Mutex`.
   *
   * @param {MutexOptions} [options] - Optional configuration options for the mutex.
   *
   */
  constructor(options: MutexOptions = defaultMutexOptions) {
    super();
    this.options = { ...defaultMutexOptions, ...options };
    this.logger = this.options.logger!;
    this.timer = this.options.timer!;

    this.logger.debug('Mutex instance created', {
      initialLocked: this._locked,
      initialQueueLength: this._queue.length,
    });

    // Set up periodic priority adjustment if interval is provided
    const adjustmentInterval = this.options.priority?.adjustmentInterval;
    if (typeof adjustmentInterval === 'number' && adjustmentInterval > 0) {
      setInterval(() => {
        this.adjustPriorities();
      }, adjustmentInterval);
    }
  }

  /**
   * Acquires the mutex lock, waiting if necessary.
   *
   * @param {number} [timeout] - Optional timeout in milliseconds. If specified, the lock will not be acquired after the timeout expires.
   * @param {MutexOwner} [owner] - Optional owner identifier for reentrant lock support.
   * @param {number} [priority] - Optional priority for the acquisition request.
   * @returns {Promise<() => void>} A promise that resolves to a function to release the lock.
   * @throws {MutexError} If the lock cannot be acquired within the timeout.
   */
  public async acquire(
    timeout?: number,
    owner?: MutexOwner,
    priority?: number,
    signal?: AbortSignal,
    backoffOptions?: BackoffOptions,
  ): Promise<() => void> {
    const {
      maxAttempts = 1,
      initialDelay = 0,
      factor = 1,
      maxDelay = 0,
    } = backoffOptions || this.options.backoff || {};

    let attempt = 0;
    let delay = initialDelay;
    let lastError: any;

    // Before attempting to wait on this mutex, record the dependency and check for deadlock
    if (owner) {
      // Add a temporary dependency: owner -> this mutex
      if (!this.dependencyGraph.has(this)) {
        this.dependencyGraph.set(this, new Set());
      }
      this.dependencyGraph.get(this)!.add(owner);

      if (this.detectCycle(owner, this)) {
        // Deadlock detected, cleanup and respond accordingly
        this.dependencyGraph.get(this)!.delete(owner);
        // Handle deadlock resolution or throw error
        throw new MutexError('Deadlock detected', 'DEADLOCK');
      }
    }

    const attemptAcquire = (): Promise<() => void> => {
      const effectiveTimeout = timeout ?? this.options.defaultTimeout;
      this.logger.debug('Attempting to acquire mutex', {
        timeout: effectiveTimeout,
      });
      this.emit('acquireAttempt', { timeout: effectiveTimeout });

      if (this.options.reentrant && this.isReentrant(owner)) {
        return Promise.resolve(this.handleReentrant(owner));
      }

      return new Promise<() => void>((resolve, reject) => {
        // Abort handling setup
        if (signal?.aborted) {
          return reject(new MutexError('Aborted', 'ABORTED'));
        }
        const abortHandler = () => {
          reject(new MutexError('Aborted', 'ABORTED'));
        };
        signal?.addEventListener('abort', abortHandler);

        let released = false;
        let timerId: TimerId | null = null;

        const cleanup = () => {
          signal?.removeEventListener('abort', abortHandler);
        };

        const unlock = () => {
          if (released) {
            this.logger.warn(
              'Attempt to release mutex that is already released',
            );
            return;
          }
          released = true;
          this.logger.debug('Mutex released via unlock function');
          this.release();
        };

        const tryAcquire = () => {
          this.logger.debug('Trying to acquire mutex lock');
          if (!this._locked) {
            this.lock(owner);
            if (timerId) this.clearTimer(timerId);
            cleanup(); // remove abort listener on success
            resolve(unlock);
          } else {
            this.enqueueRequest(owner, priority, tryAcquire);
          }
        };

        if (effectiveTimeout > 0) {
          timerId = this.setupTimeout(
            effectiveTimeout,
            owner,
            tryAcquire,
            reject,
          );
        }

        try {
          tryAcquire();
        } catch (error) {
          this.handleAcquireError(error, timerId, reject);
        }
      });
    };

    while (attempt < maxAttempts) {
      try {
        return await attemptAcquire();
      } catch (error) {
        lastError = error;
        // If aborted, exit early without retrying.
        if (error instanceof MutexError && error.code === 'ABORTED') {
          throw error;
        }
        attempt++;
        if (attempt >= maxAttempts) break;
        this.logger.warn(
          `Acquire attempt ${attempt} failed. Retrying in ${delay}ms...`,
        );
        await new Promise((res) => setTimeout(res, delay));
        delay = Math.min(delay * factor, maxDelay);
      }
    }

    throw new MutexError('Failed to acquire the mutex lock', 'ACQUIRE_FAILED', {
      error: lastError,
    });
  }

  private detectCycle(owner: MutexOwner, targetMutex: Mutex<any>): boolean {
    const visited = new Set<MutexOwner>();

    const dfs = (currentOwner: MutexOwner): boolean => {
      if (visited.has(currentOwner)) return false;
      visited.add(currentOwner);

      // Get all mutexes held by the current owner
      const heldMutexes = this.ownerHolds.get(currentOwner) || new Set();

      // If targetMutex is among held mutexes, check waiting owners for a cycle
      if (heldMutexes.has(targetMutex)) {
        const waitingOwners =
          this.dependencyGraph.get(targetMutex) || new Set();
        for (const waitingOwner of waitingOwners) {
          // If we find the original owner waiting on targetMutex, we detected a cycle
          if (waitingOwner === owner) return true;
          // Continue DFS from waitingOwner
          if (dfs(waitingOwner)) return true;
        }
      }

      // Traverse through other held mutexes
      for (const mutex of heldMutexes) {
        const waitingOwners = this.dependencyGraph.get(mutex) || new Set();
        for (const waitingOwner of waitingOwners) {
          if (waitingOwner === owner) return true;
          if (dfs(waitingOwner)) return true;
        }
      }

      return false;
    };

    return dfs(owner);
  }

  /**
   * Tries to acquire the mutex without waiting.
   * @returns {(() => void) | null} The unlock function if acquired, or null if not.
   */
  public tryAcquire(owner?: MutexOwner): (() => void) | null {
    this.logger.debug('Attempting tryAcquire on mutex');

    // Handle reentrant acquisition if enabled and the same owner is requesting.
    if (this.options.reentrant && this.isReentrant(owner)) {
      return this.handleReentrant(owner);
    }

    // Attempt immediate acquisition if the mutex is not locked.
    if (!this._locked) {
      this.lock(owner);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.logger.debug('Mutex released via tryAcquire unlock function');
        this.release();
      };
    }

    this.logger.debug('tryAcquire failed: Mutex already locked');
    return null;
  }

  public async readLock(
    timeout?: number,
    owner?: MutexOwner,
    priority?: number,
  ): Promise<() => void> {
    return new Promise<() => void>((resolve, reject) => {
      let timerId: TimerId | null = null;
      let released = false;

      const unlock = () => {
        if (released) return;
        released = true;
        this.readerCount = Math.max(this.readerCount - 1, 0);
        this.logger.debug('Reader lock released', {
          readerCount: this.readerCount,
        });
        this.processQueue(); // Attempt to process queued requests
      };

      const tryAcquireRead = () => {
        const writerWaiting = this._queue.some(
          (entry) =>
            entry.type === MutexOperation.Write &&
            (!this.options.fairness || entry.priority >= (priority ?? 0)),
        );

        // Allow read lock if no active writer and no higher-priority writer waiting
        if (!this.writerActive && !writerWaiting) {
          if (timerId) this.clearTimer(timerId); // Clear timer if set
          this.readerCount++;
          resolve(unlock);
        } else {
          this.enqueueRequest(
            owner,
            priority,
            tryAcquireRead,
            MutexOperation.Read,
          );
        }
      };
      // Setup timeout if specified
      if ((timeout ?? this.options.defaultTimeout) > 0) {
        timerId = this.setupTimeout(
          timeout ?? this.options.defaultTimeout,
          owner,
          tryAcquireRead,
          reject,
        );
      }
      tryAcquireRead();
    });
  }

  public async writeLock(
    timeout?: number,
    owner?: MutexOwner,
    priority?: number,
  ): Promise<() => void> {
    return new Promise<() => void>((resolve, reject) => {
      let timerId: TimerId | null = null;
      let released = false;

      const unlock = () => {
        if (released) return;
        released = true;
        this.writerActive = false;
        this.logger.debug('Writer lock released');
        this.processQueue(); // Attempt to process queued requests
      };

      const tryAcquireWrite = () => {
        // Allow write lock if no active writer or readers
        if (!this.writerActive && this.readerCount === 0) {
          if (timerId) this.clearTimer(timerId); // Clear timer if set
          this.writerActive = true;
          resolve(unlock);
        } else {
          this.enqueueRequest(
            owner,
            priority,
            tryAcquireWrite,
            MutexOperation.Write,
          );
        }
      };
      // Setup timeout if specified
      if ((timeout ?? this.options.defaultTimeout) > 0) {
        timerId = this.setupTimeout(
          timeout ?? this.options.defaultTimeout,
          owner,
          tryAcquireWrite,
          reject,
        );
      }
      tryAcquireWrite();
    });
  }

  private processQueue(): void {
    // Determine which scheduling strategy to use
    const strategy = this.options.schedulingStrategy || 'fifo';

    // Use different processing logic based on strategy
    if (strategy === 'priorityQueue' || strategy === 'weighted') {
      if (this._priorityQueue.isEmpty()) return;
      const nextEntry = this._priorityQueue.extract();
      // Process the extracted entry:
      this.handleQueueEntry(nextEntry);
    } else if (strategy === 'roundRobin') {
      // For round-robin, rotate the _queue array
      if (this._queue.length === 0) return;
      const nextEntry = this._queue.shift()!;
      this._queue.push(nextEntry); // rotate to end
      this.handleQueueEntry(nextEntry);
    } else {
      // Default FIFO behavior
      if (this._queue.length === 0) return;
      const nextEntry = this._queue.shift()!;
      this.handleQueueEntry(nextEntry);
    }
  }

  private handleQueueEntry(next: QueueEntry<MutexOwner>): void {
    if (next.type === MutexOperation.Read) {
      // If a writer is active or higher-priority writer waiting, skip processing.
      const writerWaiting = this._queue.some(
        (entry) =>
          entry.type === MutexOperation.Write &&
          (!this.options.fairness || entry.priority >= (next.priority ?? 0)),
      );
      if (this.writerActive || writerWaiting) return;

      this.readerCount++;
      next.resolver();
    } else if (next.type === MutexOperation.Write) {
      if (!this.writerActive && this.readerCount === 0) {
        this.writerActive = true;
        next.resolver();
      }
    }
    // Optionally continue processing if conditions allow.
  }

  private adjustPriorities(): void {
    // Iterate through all entries in the priority queue
    const allEntries = this._priorityQueue.toArray();
    for (const entry of allEntries) {
      // Increase priority based on waiting time using enqueuedAt
      const waitingTime = Date.now() - (entry.enqueuedAt || Date.now());
      entry.priority += this.calculateAdjustment(waitingTime);
    }
    this._priorityQueue.buildHeap(allEntries);
  }

  private calculateAdjustment(waitingTime: number): number {
    const factor = this.options.priority.adjustmentFactor ?? 1;
    const exponent = this.options.priority.adjustmentExponent ?? 1;
    const maxIncrement = this.options.priority.maxIncrement ?? Infinity;

    // Non-linear adjustment: factor * (waitingTime in seconds)^exponent
    let adjustment = factor * Math.pow(waitingTime / 1000, exponent);

    // Cap the adjustment to the maximum allowed increment if specified
    return Math.min(Math.floor(adjustment), maxIncrement);
  }

  /**
   * Releases the mutex lock and allows the next queued resolver (if any) to acquire it.
   *
   * @emits {released} Emits a 'released' event when the lock is released.
   * @emits {releaseAttempt} Emits a 'releaseAttempt' event when attempting to release the lock.
   * @emits {error} Emits an 'error' event if an error occurs during the release process.
   * @emits {reentrantReleased} Emits a 'reentrantReleased' event when a reentrant lock is released.
   * @returns {void}
   */
  private release(): void {
    const owner = this._owner;
    if (owner) {
      // Remove mutex from the owner's held set
      this.ownerHolds.get(owner)?.delete(this);
      // If no more mutexes held by this owner, clean up
      if (this.ownerHolds.get(owner)?.size === 0) {
        this.ownerHolds.delete(owner);
      }
    }
    this.logger.debug('Releasing mutex lock', {
      currentQueueLength: this._queue.length,
    });
    this.emit('releaseAttempt', {
      owner: this._owner,
      queueLength: this._queue.length,
    });

    try {
      if (this._queue.length > 0) {
        this._locked = false;
        const nextEntry = this._queue.shift();
        this.logger.info(
          'Mutex lock released, passing to next request in queue',
          {
            remainingQueueLength: this._queue.length,
          },
        );
        nextEntry?.resolver();
      } else {
        this._locked = false;
        this.logger.info('Mutex lock released, no pending requests');
      }
      this.emit('released', {
        owner: this._owner,
        remainingQueueLength: this._queue.length,
      });
    } catch (error) {
      this.logger.error('Failed to release the mutex lock', { error });
      this._locked = false;
    }
  }
  /**
   * Executes a function exclusively, ensuring it has the mutex lock.
   *
   * @param {() => Promise<T> | T} fn - The function to execute.
   * @param {number} [timeout] - Optional timeout in milliseconds for acquiring the lock.
   * @returns {Promise<T>} A promise that resolves to the result of the function.
   * @template T
   * @throws {MutexError} If the lock cannot be acquired or an error occurs during execution.
   */
  public async runExclusive<T>(
    fn: () => Promise<T> | T,
    timeout?: number,
  ): Promise<T> {
    const effectiveTimeout = timeout ?? this.options.defaultTimeout;
    this.logger.debug('runExclusive called', { timeout: effectiveTimeout });

    let unlock: () => void;
    try {
      unlock = await this.acquire(effectiveTimeout);
      this.logger.debug('runExclusive acquired mutex lock');
    } catch (error) {
      this.logger.error('Failed to acquire mutex lock in runExclusive', {
        error,
      });
      throw error;
    }

    try {
      const result = await fn();
      this.logger.debug('runExclusive function executed successfully', {
        result,
      });
      return result;
    } catch (error) {
      this.logger.error('Error during exclusive execution', { error });
      this.handleExecutionError(error);
    } finally {
      this.safeRelease(unlock);
      this.logger.debug('runExclusive released mutex lock');
    }
  }
  /**
   * Returns whether the mutex is currently locked.
   *
   * @returns {boolean} True if the mutex is locked, false otherwise.
   */
  public get locked(): boolean {
    this.logger.debug('Getter accessed: locked', { locked: this._locked });
    return this._locked;
  }

  /**
   * Returns the number of requests waiting in the queue.
   *
   * @returns {number} The length of the mutex queue.
   */
  public get queue(): number {
    this.logger.debug('Getter accessed: queue', {
      queueLength: this._queue.length,
    });
    return this._queue.length;
  }

  /**
   * Returns the current owner of the mutex lock.
   *
   * @returns {MutexOwner | null} The current owner of the mutex lock.
   */
  public get owner(): MutexOwner | null {
    this.logger.debug('Getter accessed: owner', { owner: this._owner });
    return this._owner;
  }

  /**
   * Handles errors during the mutex acquisition process.
   *
   * @private
   * @param {any} error - The error encountered.
   * @param {TimerId | null} timerId - The timeout ID to clear.
   * @param {(reason?: any) => void} reject - The rejection callback.
   */
  private handleAcquireError(
    error: any,
    timerId: TimerId | null,
    reject: (reason?: any) => void,
  ): void {
    if (timerId) this.clearTimer(timerId);
    try {
      this.logger.error('Error while trying to acquire mutex', { error });
    } catch (loggerErr) {
      console.error('Logger error in handleAcquireError:', loggerErr);
    }
    this.emit('error', { phase: 'acquire', error });
    reject(
      new MutexError('Failed to acquire the mutex lock', 'ACQUIRE_FAILED', {
        error,
      }),
    );
  }

  /**
   * Returns true if the mutex is currently locked by the same owner.
   *
   * @remarks
   * By default, this comparison uses strict equality. For complex owner types,
   * provide a custom `ownerEqualityFn` in `MutexOptions`.
   *
   * @param {owner} MutexOwner | undefined
   * @returns {boolean} True if the mutex is currently locked by the same owner, false otherwise.
   */
  private isReentrant(owner: MutexOwner | undefined): boolean {
    return this._locked && this._owner === owner;
  }

  /**
   * Handles reentrant lock requests.
   *
   * @param {MutexOwner} owner - The owner of the reentrant lock.
   * @returns {() => void} A function to release the reentrant lock.
   */
  private handleReentrant(owner: MutexOwner | undefined): () => void {
    this._reentrantCount++;
    this.logger.debug('Reentrant lock acquired', {
      count: this._reentrantCount,
    });
    this.emit('reentrantAcquired', { owner, count: this._reentrantCount });
    return () => {
      this._reentrantCount--;
      this.logger.debug('Reentrant unlock', { count: this._reentrantCount });
      if (this._reentrantCount === 0) {
        this.release();
        this._owner = null;
      }
    };
  }

  /**
   * Locks the mutex for the specified owner.
   *
   * @param {MutexOwner | undefined} owner - The owner of the lock.
   * @returns {void}
   */
  private lock(owner: MutexOwner | undefined): void {
    this._locked = true;
    this._owner = owner;
    this._reentrantCount = 1;

    if (owner) {
      // Remove dependency as it is no longer waiting
      this.dependencyGraph.get(this)?.delete(owner);
      // Register that the owner now holds this mutex
      if (!this.ownerHolds.has(owner)) {
        this.ownerHolds.set(owner, new Set());
      }
      this.ownerHolds.get(owner)!.add(this);
    }

    this.logger.info('Mutex lock acquired', {
      currentQueueLength: this._queue.length,
    });
    this.emit('acquired', { queueLength: this._queue.length });
  }

  /**
   * Enqueues a request for the mutex lock.
   *
   * @param {MutexOwner} owner - The owner of the lock.
   * @param {number | undefined} priority - The priority of the request.
   * @param {() => void} resolver - The resolver function for the request.
   * @returns {void}
   */
  private enqueueRequest(
    owner: MutexOwner,
    priority: number | undefined,
    resolver: () => void,
    type: MutexOperation = MutexOperation.Write,
  ): void {
    const entry: QueueEntry<MutexOwner> = {
      resolver,
      priority: this.options.priority ? (priority ?? 0) : 0,
      owner,
      type,
      weight: 1,
      enqueuedAt: Date.now(),
    };

    // Always insert into the priority queue for strategies that require it.
    if (
      this.options.schedulingStrategy === SchedulingStrategy.PriorityQueue ||
      this.options.schedulingStrategy === SchedulingStrategy.Weighted
    ) {
      this._priorityQueue.insert(entry);
    }

    // For FIFO or round-robin, maintain the simple array.
    this._queue.push(entry);

    this.logger.info('Mutex is locked, adding to queue', {
      queueLengthBefore: this._queue.length - 1,
    });
    this.logger.debug('Current queue length', {
      queueLength: this._queue.length,
    });
  }

  /**
   * Sets up a timeout for the mutex acquisition.
   *
   * @param {number} timeout - The timeout in milliseconds.
   * @param {MutexOwner | undefined} owner - The owner of the lock.
   * @param {() => void} resolver - The resolver function for the request.
   * @param {(reason?: any) => void} reject - The rejection callback.
   * @returns {TimerId} The ID of the timeout.
   */
  private setupTimeout(
    timeout: number,
    owner: MutexOwner | undefined,
    resolver: () => void,
    reject: (reason?: any) => void,
  ): TimerId {
    this.logger.debug('Setting timeout for mutex acquisition', { timeout });
    return this.timer.setTimeout(() => {
      const index = this._queue.findIndex(
        (entry) => entry.resolver === resolver,
      );
      if (index > -1) {
        this._queue.splice(index, 1);
        this.logger.warn(
          'Mutex acquisition timed out and request removed from queue',
          {
            queueLengthAfter: this._queue.length,
          },
        );
      }
      this.emit('timeout', { owner, timeout, queueLength: this._queue.length });
      reject(new MutexError('Acquire timed out', 'ACQUIRE_TIMEOUT'));
    }, timeout);
  }

  /**
   * Handles errors during exclusive execution
   *
   * @param {error | any} error
   * @returns {never}
   */
  private handleExecutionError(error: any): never {
    if (this.options.cancelOnError) {
      this._queue.length = 0;
    }
    if (error instanceof ClientError) {
      throw error;
    }
    throw new MutexError(
      'Error during exclusive execution',
      'EXECUTION_FAILED',
      { error },
    );
  }

  /**
   * Safely releases the mutex lock after execution.
   *
   * @param {unlock} () => void
   * @returns {void}
   */
  private safeRelease(unlock: () => void): void {
    try {
      unlock();
    } catch (error) {
      this.logger.error('Failed to release the mutex lock after execution', {
        error,
      });
    }
  }

  /**
   * Clears the timeout for the specified ID.
   *
   * @param {TimerId} timerId - The ID of the timeout to clear.
   * @returns {void}
   */
  private clearTimer(timerId: TimerId) {
    this.timer.clearTimeout(timerId);
    this.logger.debug('Timeout cleared after acquiring mutex');
  }

  /**
   * Returns a snapshot of the current mutex state for debugging purposes.
   *
   * @returns {MutexState<MutexOwner>} A snapshot of the mutex state.
   */
  public dump(): MutexState<MutexOwner> {
    // Snapshot of the queue entries
    const queueSnapshot = this._queue.map((entry) => ({
      owner: entry.owner,
      priority: entry.priority,
      type: entry.type,
      weight: entry.weight,
      enqueuedAt: entry.enqueuedAt,
    }));

    // Snapshot of the priority queue entries, if used
    const priorityQueueSnapshot = this._priorityQueue
      .toArray()
      .map((entry) => ({
        owner: entry.owner,
        priority: entry.priority,
        type: entry.type,
        weight: entry.weight,
        enqueuedAt: entry.enqueuedAt,
      }));

    // Snapshot of the dependency graph
    const dependencyGraphSnapshot: Record<string, string[]> = {};
    for (const [mutex, owners] of this.dependencyGraph.entries()) {
      // Represent each mutex by an identifier (could be a name, id, or memory reference)
      const mutexId =
        mutex.constructor.name + '@' + (mutex._owner?.toString() || 'unowned');
      dependencyGraphSnapshot[mutexId] = Array.from(owners).map((owner) =>
        owner?.toString(),
      );
    }

    // Snapshot of owner holdings
    const ownerHoldsSnapshot: Record<string, string[]> = {};
    for (const [owner, mutexes] of this.ownerHolds.entries()) {
      ownerHoldsSnapshot[owner?.toString()] = Array.from(mutexes).map(
        (m) => m.constructor.name + '@' + (m._owner?.toString() || 'unowned'),
      );
    }

    return {
      locked: this._locked,
      currentOwner: this._owner,
      reentrantCount: this._reentrantCount,
      readerCount: this.readerCount,
      writerActive: this.writerActive,
      queueLength: this._queue.length,
      queue: queueSnapshot,
      priorityQueue: priorityQueueSnapshot,
      dependencyGraph: dependencyGraphSnapshot,
      ownerHolds: ownerHoldsSnapshot,
    };
  }
}
