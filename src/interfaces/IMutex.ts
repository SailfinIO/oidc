/**
 * @fileoverview
 * Defines the `IMutex` interface for managing mutual exclusion in asynchronous operations.
 * This interface provides a contract for implementing mutex utilities that control access
 * to shared resources, ensuring that only one asynchronous operation can access the resource
 * at a time.
 *
 * @module src/interfaces/IMutex
 */

/**
 * Represents a function that resolves the mutex acquisition.
 */
export type Resolver = () => void;

/**
 * Represents the ID of a timer created with `setTimeout`.
 */
export type TimerId = NodeJS.Timeout;

/**
 * Represents a timer utility with `setTimeout` and `clearTimeout` methods.
 */
export interface ITimer {
  /**
   * Schedules a function to be executed after a specified delay.
   *
   * @param {(...args: any[]) => void} handler - The function to execute.
   * @param {number} [timeout] - The delay in milliseconds before executing the handler.
   * @returns {TimerId} The identifier of the timer.
   */
  setTimeout: (handler: (...args: any[]) => void, timeout?: number) => TimerId;

  /**
   * Cancels a previously scheduled function execution.
   *
   * @param {TimerId} timerId - The identifier of the timer to cancel.
   */
  clearTimeout: (timerId: TimerId) => void;
}

/**
 * Defines the `IMutex` interface for managing mutual exclusion in asynchronous operations.
 *
 * The `IMutex` interface provides methods for acquiring and releasing a mutex lock,
 * ensuring that only one asynchronous operation can access a shared resource at a time.
 * It also offers a utility method to execute a function exclusively within the mutex lock.
 */
export interface IMutex {
  /**
   * Acquires the mutex lock.
   *
   * This method attempts to acquire the mutex. If the mutex is already locked, the
   * method will wait until the lock becomes available or until the optional timeout
   * is reached. Upon successful acquisition, it resolves with a release function
   * that must be called to release the mutex.
   *
   * @param {number} [timeout] - Optional timeout in milliseconds after which the acquisition attempt is aborted.
   * @returns {Promise<() => void>} A promise that resolves to a release function.
   *
   * @throws {MutexError} If the mutex acquisition fails or times out.
   *
   * @example
   * ```typescript
   * const release = await mutex.acquire(5000); // Wait up to 5 seconds to acquire the mutex
   * try {
   *   // Critical section: perform operations that require mutual exclusion
   * } finally {
   *   release(); // Always release the mutex
   * }
   * ```
   */
  acquire(timeout?: number): Promise<() => void>;

  /**
   * Executes a function exclusively within the mutex lock.
   *
   * This method acquires the mutex, executes the provided function, and then releases
   * the mutex, ensuring that the function runs in a mutually exclusive context. If a
   * timeout is specified, the method will wait up to the specified duration to acquire
   * the mutex before throwing an error.
   *
   * @param {() => Promise<T> | T} fn - The function to execute exclusively.
   * @param {number} [timeout] - Optional timeout in milliseconds for acquiring the mutex.
   * @returns {Promise<T>} A promise that resolves to the result of the executed function.
   *
   * @throws {MutexError} If the mutex acquisition fails or the executed function throws an error.
   *
   * @example
   * ```typescript
   * const result = await mutex.runExclusive(async () => {
   *   // Critical section: perform operations that require mutual exclusion
   *   return await someAsyncOperation();
   * }, 5000); // Wait up to 5 seconds to acquire the mutex
   * console.log('Operation result:', result);
   * ```
   */
  runExclusive<T>(fn: () => Promise<T> | T, timeout?: number): Promise<T>;

  /**
   * Indicates whether the mutex is currently locked.
   *
   * @readonly
   * @type {boolean}
   *
   * @example
   * ```typescript
   * if (mutex.locked) {
   *   console.log('Mutex is currently locked.');
   * } else {
   *   console.log('Mutex is available.');
   * }
   * ```
   */
  readonly locked: boolean;

  /**
   * Returns the number of pending mutex acquisition requests.
   *
   * @readonly
   * @type {number}
   *
   * @example
   * ```typescript
   * console.log(`Number of queued requests: ${mutex.queue}`);
   * ```
   */
  readonly queue: number;
}
