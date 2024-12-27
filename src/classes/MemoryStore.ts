// src/classes/MemoryStore.ts

import { IStore, ISessionData, ILogger } from '../interfaces';
import { Cache } from '../cache/Cache';
import { Mutex } from '../utils/Mutex';

export class MemoryStore implements IStore {
  private readonly cache: Cache<ISessionData>;
  private readonly mutex: Mutex;
  private readonly ttl: number = 3600000; // 1 hour in ms

  constructor(
    private readonly logger?: ILogger,
    ttl?: number,
  ) {
    this.logger = logger ?? {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      setLogLevel: () => {},
    };
    this.ttl = ttl || this.ttl;
    this.cache = new Cache<ISessionData>(this.logger, this.ttl);
    this.mutex = new Mutex(this.logger);
  }

  /**
   * Stores session data with the provided SID.
   * @param sid - The session ID.
   * @param data - The session data to store.
   * @returns {Promise<void>} A promise that resolves when the data is set.
   */
  public async set(sid: string, data: ISessionData): Promise<void> {
    return this.mutex.runExclusive(async () => {
      this.cache.set(sid, data);
      this.logger.debug('Session created', { sid });
    });
  }

  /**
   * Retrieves session data based on the SID.
   * @param sid - The session ID.
   * @returns {Promise<ISessionData | null> } The session data or null if not found.
   */
  public async get(sid: string): Promise<ISessionData | null> {
    return this.mutex.runExclusive(() => {
      const session = this.cache.get(sid) || null;
      this.logger.debug('Session retrieved', { sid, session });
      return session;
    });
  }

  /**
   * Destroys the session associated with the SID.
   * @param sid - The session ID.
   * @returns {Promise<void>} A promise that resolves when the session is destroyed.
   */
  public async destroy(sid: string): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.cache.delete(sid);
      this.logger.debug('Session deleted', { sid });
    });
  }

  /**
   * Updates the session's expiration without altering the data.
   * @param sid - The session ID.
   * @param session - The current session data.
   * @returns {Promise<void>} A promise that resolves when the session is touched.
   */
  public async touch(sid: string, session: ISessionData): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.cache.set(sid, session);
      this.logger.debug('Session updated', { sid });
    });
  }
}
