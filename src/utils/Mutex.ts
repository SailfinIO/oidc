/**
 * @fileoverview
 * Implements the `Mutex` class, a utility for controlling access to asynchronous resources.
 * The mutex ensures mutual exclusion by allowing only one execution thread to acquire the lock
 * at a time. It supports timeouts, queueing, and error handling.
 *
 * @module src/utils/Mutex
 */

import { ILogger, IMutex, Resolver, ITimer, TimerId } from '../interfaces';
import { MutexError, ClientError } from '../errors';

/**
 * Represents a mutex (mutual exclusion) utility for controlling access to asynchronous resources.
 *
 * The `Mutex` class provides a thread-safe mechanism for exclusive access, with support for queueing,
 * timeouts, and structured logging.
 *
 * @class
 * @implements {IMutex}
 */
export class Mutex implements IMutex {
  private readonly _queue: Resolver[] = [];
  private readonly timer: ITimer;
  private _locked: boolean = false;

  /**
   * Creates an instance of `Mutex`.
   *
   * @param {ILogger} [logger] - Optional logger instance for logging mutex operations.
   * @param {ITimer} [timer] - Optional timer implementation for timeouts (defaults to global setTimeout/clearTimeout).
   */
  constructor(
    private readonly logger?: ILogger,
    timer?: ITimer,
  ) {
    this.timer = timer ?? {
      setTimeout: setTimeout.bind(globalThis),
      clearTimeout: clearTimeout.bind(globalThis),
    };
    this.logger = logger ?? {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      setLogLevel: () => {},
    };
    this.logger.debug('Mutex instance created', {
      initialLocked: this._locked,
      initialQueueLength: this._queue.length,
    });
  }

  /**
   * Acquires the mutex lock, waiting if necessary.
   *
   * @param {number} [timeout] - Optional timeout in milliseconds. If specified, the lock will not be acquired after the timeout expires.
   * @returns {Promise<() => void>} A promise that resolves to a function to release the lock.
   * @throws {MutexError} If the lock cannot be acquired within the timeout.
   */
  public async acquire(timeout?: number): Promise<() => void> {
    this.logger.debug('Attempting to acquire mutex', { timeout });

    return new Promise<() => void>((resolve, reject) => {
      let released = false;
      let timerId: TimerId | null = null;

      const unlock = () => {
        if (!released) {
          released = true;
          this.logger.debug('Mutex released via unlock function');
          this.release();
        }
      };

      const enqueue = () => {
        this._queue.push(tryAcquire);
        this.logger.info('Mutex is locked, adding to queue', {
          queueLengthBefore: this._queue.length - 1,
        });
        this.logger.debug('Current queue length', {
          queueLength: this._queue.length,
        });
      };

      const tryAcquire = () => {
        this.logger.debug('Trying to acquire mutex lock');
        if (!this._locked) {
          this._locked = true;
          this.logger.info('Mutex lock acquired', {
            currentQueueLength: this._queue.length,
          });
          if (timerId) {
            this.timer.clearTimeout(timerId);
            this.logger.debug('Timeout cleared after acquiring mutex');
          }
          resolve(unlock);
        } else {
          enqueue();
        }
      };

      if (timeout !== undefined) {
        timerId = this.timer.setTimeout(() => {
          if (!released) {
            released = true;
            const index = this._queue.indexOf(tryAcquire);
            if (index > -1) {
              this._queue.splice(index, 1);
              this.logger.warn(
                'Mutex acquisition timed out and request removed from queue',
                {
                  queueLengthAfter: this._queue.length,
                },
              );
            }
            reject(new MutexError('Acquire timed out', 'ACQUIRE_TIMEOUT'));
          }
        }, timeout);
        this.logger.debug('Setting timeout for mutex acquisition', { timeout });
      }

      try {
        tryAcquire();
      } catch (error) {
        this.handleAcquireError(error, timerId, reject);
      }
    });
  }

  /**
   * Releases the mutex lock and allows the next queued resolver (if any) to acquire it.
   *
   * @private
   */
  private release(): void {
    this.logger.debug('Releasing mutex lock', {
      currentQueueLength: this._queue.length,
    });
    try {
      if (this._queue.length > 0) {
        this._locked = false;
        const nextRequest = this._queue.shift();
        this.logger.info(
          'Mutex lock released, passing to next request in queue',
          {
            remainingQueueLength: this._queue.length,
          },
        );
        nextRequest?.(); // Allow the next request to acquire the lock
      } else {
        this._locked = false;
        this.logger.info('Mutex lock released, no pending requests');
      }
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
    this.logger.debug('runExclusive called', { timeout });
    let unlock: () => void;
    try {
      unlock = await this.acquire(timeout);
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
      if (error instanceof ClientError) {
        throw error;
      }
      throw new MutexError(
        'Error during exclusive execution',
        'EXECUTION_FAILED',
        { error },
      );
    } finally {
      try {
        unlock();
        this.logger.debug('runExclusive released mutex lock');
      } catch (error) {
        this.logger.error('Failed to release the mutex lock after execution', {
          error,
        });
      }
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
    if (timerId) this.timer.clearTimeout(timerId);
    try {
      this.logger.error('Error while trying to acquire mutex', { error });
    } catch (loggerError) {
      console.error('Logger error in handleAcquireError:', loggerError);
    }
    reject(
      new MutexError('Failed to acquire the mutex lock', 'ACQUIRE_FAILED', {
        error,
      }),
    );
  }
}
