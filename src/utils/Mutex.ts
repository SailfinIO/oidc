import { ILogger, IMutex, Resolver, ITimer } from '../interfaces';
import { MutexError, ClientError } from '../errors';

/**
 * A mutex (mutual exclusion) utility for controlling access to asynchronous resources.
 */
export class Mutex implements IMutex {
  private readonly _queue: Resolver[] = [];
  private readonly timer: ITimer;
  private _locked: boolean = false;

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

  public async acquire(timeout?: number): Promise<() => void> {
    this.logger.debug('Attempting to acquire mutex', { timeout });

    return new Promise<() => void>((resolve, reject) => {
      let released = false;
      let timerId: ReturnType<typeof setTimeout> | null = null;

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

      // Set the timeout BEFORE attempting to acquire the lock
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

  private release(): void {
    this.logger.debug('Releasing mutex lock', {
      currentQueueLength: this._queue.length,
    });
    try {
      if (this._queue.length > 0) {
        this._locked = false; // Unlock before passing to the next request
        const nextRequest = this._queue.shift();
        this.logger.info(
          'Mutex lock released, passing to next request in queue',
          {
            remainingQueueLength: this._queue.length,
          },
        );
        nextRequest?.(); // Now the next request can acquire the lock
      } else {
        this._locked = false;
        this.logger.info('Mutex lock released, no pending requests');
      }
    } catch (error) {
      this.logger.error('Failed to release the mutex lock', { error });
      this._locked = false;
    }
  }

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
      throw error; // Re-throw to maintain behavior
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

  public get locked(): boolean {
    this.logger.debug('Getter accessed: locked', { locked: this._locked });
    return this._locked;
  }

  public get queue(): number {
    this.logger.debug('Getter accessed: queue', {
      queueLength: this._queue.length,
    });
    return this._queue.length;
  }

  // Centralized error handling for acquire
  private handleAcquireError(
    error: any,
    timerId: ReturnType<typeof setTimeout> | null,
    reject: (reason?: any) => void,
  ): void {
    if (timerId) this.timer.clearTimeout(timerId);
    try {
      this.logger.error('Error while trying to acquire mutex', { error });
    } catch (loggerError) {
      // Prevent logger errors from propagating
      console.error('Logger error in handleAcquireError:', loggerError);
    }
    reject(
      new MutexError('Failed to acquire the mutex lock', 'ACQUIRE_FAILED', {
        error,
      }),
    );
  }
}
