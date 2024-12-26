import { IStore, ISessionData, IMutex, ILogger } from '../interfaces';
import { Cache } from '../cache/Cache';
import { Mutex } from '../utils/Mutex';
import { randomUUID } from 'crypto';

export class MemoryStore implements IStore {
  private readonly cache: Cache<ISessionData>;
  private readonly mutex: IMutex;
  private readonly defaultTTL: number = 3600000;

  constructor(
    private readonly logger?: ILogger,
    defaultTTL?: number,
  ) {
    this.logger = logger ?? {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      setLogLevel: () => {},
    };
    this.defaultTTL = defaultTTL || this.defaultTTL;
    this.cache = new Cache<ISessionData>(logger, defaultTTL);
    this.mutex = new Mutex(logger);
  }

  public async set(data: ISessionData): Promise<string> {
    return this.mutex.runExclusive(() => {
      const sid = randomUUID();
      this.cache.set(sid, data);
      this.logger.debug('Session created', { sid });
      return sid;
    });
  }

  public async get(sid: string): Promise<ISessionData | null> {
    return this.mutex.runExclusive(() => {
      const session = this.cache.get(sid) || null;
      this.logger.debug('Session retrieved', { sid, session });
      return session;
    });
  }

  public async destroy(sid: string): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.cache.delete(sid);
      this.logger.debug('Session deleted', { sid });
    });
  }

  public async touch(sid: string, session: ISessionData): Promise<void> {
    return this.mutex.runExclusive(() => {
      this.cache.set(sid, session);
      this.logger.debug('Session updated', { sid });
    });
  }
}
