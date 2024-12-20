import { ICache, ILogger } from '../interfaces';
import { ClientError } from '../errors/ClientError';

/**
 * Represents an in-memory cache with basic CRUD operations.
 *
 * @class InMemoryCache
 * @implements {ICache<T>}
 */
export class InMemoryCache<T> implements ICache<T> {
  /**
   * The internal storage for the cache entries.
   *
   * @private
   * @readonly
   */
  private readonly store: Map<string, { value: T; expiresAt: number }> =
    new Map();

  /**
   * The logger instance for logging operations and errors.
   *
   * @private
   * @readonly
   */
  private readonly logger: ILogger;

  /**
   * Default time-to-live for cache entries in milliseconds.
   *
   * @private
   * @readonly
   */
  private readonly defaultTTL: number;

  /**
   * Creates an instance of InMemoryCache.
   *
   * @param {ILogger} logger - The logger instance for logging operations and errors.
   * @param {number} [defaultTTL=3600000] - Default time-to-live for cache entries in milliseconds.
   */
  constructor(logger: ILogger, defaultTTL: number = 3600000) {
    this.logger = logger;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Retrieves a value from the cache by key.
   *
   * @param {string} key - The key associated with the value.
   * @returns {T | undefined} The cached value or undefined if not found or expired.
   * @throws {ClientError} If the key is invalid.
   */
  public get(key: string): T | undefined {
    this.validateKey(key);

    const entry = this.store.get(key);
    if (!entry) {
      this.logger.debug(`Cache miss for key: ${key}`);
      return undefined;
    }

    if (this.isExpired(entry.expiresAt)) {
      this.store.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return undefined;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.value;
  }

  /**
   * Stores a value in the cache with an optional TTL.
   *
   * @param {string} key - The key to associate with the value.
   * @param {T} value - The value to cache.
   * @param {number} [ttl] - Time-to-live in milliseconds. Defaults to the cache's default TTL.
   * @throws {ClientError} If the key or value is invalid.
   */
  public set(key: string, value: T, ttl?: number): void {
    this.validateKey(key);
    this.validateValue(value);
    const effectiveTTL = ttl ?? this.defaultTTL;
    this.validateTTL(effectiveTTL);

    const expiresAt = Date.now() + effectiveTTL;
    this.store.set(key, { value, expiresAt });
    this.logger.debug(`Set cache for key: ${key} with TTL: ${effectiveTTL}ms`);
  }

  /**
   * Deletes a value from the cache by key.
   *
   * @param {string} key - The key of the value to delete.
   * @throws {ClientError} If the key is invalid.
   */
  public delete(key: string): void {
    this.validateKey(key);
    const existed = this.store.delete(key);
    if (existed) {
      this.logger.debug(`Deleted cache for key: ${key}`);
    } else {
      this.logger.debug(`Attempted to delete non-existent key: ${key}`);
    }
  }

  /**
   * Clears all entries from the cache.
   *
   * @throws {ClientError} If an unexpected error occurs during clearing.
   */
  public clear(): void {
    try {
      this.store.clear();
      this.logger.debug('Cleared all cache entries.');
    } catch (error) {
      this.logger.error('Failed to clear cache.', { error });
      throw new ClientError('Failed to clear cache.', 'CLEAR_CACHE_ERROR', {
        error,
      });
    }
  }

  /**
   * Returns the number of entries in the cache.
   *
   * @returns {number} The size of the cache.
   */
  public size(): number {
    return this.store.size;
  }

  /**
   * Validates the cache key.
   *
   * @private
   * @param {string} key - The key to validate.
   * @throws {ClientError} If the key is not a non-empty string.
   */
  private validateKey(key: string): void {
    if (typeof key !== 'string' || key.trim() === '') {
      this.logger.error(`Invalid key provided: "${key}"`);
      throw new ClientError('Key must be a non-empty string.', 'INVALID_KEY', {
        key,
      });
    }
  }

  /**
   * Validates the cache value.
   *
   * @private
   * @param {T} value - The value to validate.
   * @throws {ClientError} If the value is undefined or null.
   */
  private validateValue(value: T): void {
    if (value === undefined || value === null) {
      this.logger.error(`Invalid value provided: ${value}`);
      throw new ClientError(
        'Value cannot be undefined or null.',
        'INVALID_VALUE',
        { value },
      );
    }
  }

  /**
   * Validates the TTL (time-to-live).
   *
   * @private
   * @param {number} ttl - The TTL to validate.
   * @throws {ClientError} If the TTL is not a positive number.
   */
  private validateTTL(ttl: number): void {
    if (typeof ttl !== 'number' || ttl <= 0) {
      this.logger.error(`Invalid TTL provided: ${ttl}`);
      throw new ClientError('TTL must be a positive number.', 'INVALID_TTL', {
        ttl,
      });
    }
  }

  /**
   * Checks if a given timestamp has expired.
   *
   * @private
   * @param {number} expiresAt - The expiration timestamp.
   * @returns {boolean} True if expired, else false.
   */
  private isExpired(expiresAt: number): boolean {
    return Date.now() > expiresAt;
  }

  /**
   * Optional: Expose defaultTTL via a getter for better encapsulation.
   *
   * @readonly
   * @public
   */
  public get DefaultTTL(): number {
    return this.defaultTTL;
  }
}
