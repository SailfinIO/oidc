// src/classes/SessionStore.ts

import { ISessionStore, ISessionData, ILogger } from '../interfaces';
import { randomUUID } from 'crypto';
import { MemoryStore } from './MemoryStore';

export class SessionStore implements ISessionStore {
  private readonly store: MemoryStore;
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
    this.store = new MemoryStore(this.logger, this.ttl);
  }

  public async set(data: ISessionData): Promise<string> {
    const sid = randomUUID();
    this.logger.debug(`Setting session data for sid: ${sid}`);
    await this.store.set(sid, data);
    return sid;
  }

  public async get(sid: string): Promise<ISessionData | null> {
    this.logger.debug(`Getting session data for sid: ${sid}`);
    return this.store.get(sid);
  }

  public async destroy(sid: string): Promise<void> {
    this.logger.debug(`Destroying session data for sid: ${sid}`);
    return this.store.destroy(sid);
  }

  public async touch(sid: string, data: ISessionData): Promise<void> {
    this.logger.debug(`Touching session data for sid: ${sid}`);
    return this.store.touch(sid, data);
  }
}
