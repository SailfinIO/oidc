import { ILogger } from '../interfaces/ILogger';
import { ISessionStore } from '../interfaces/ISessionStore';
import { MemoryStore } from './MemoryStore';
import { CookieStore } from './CookieStore';
import { StorageMechanism } from '../enums';
import { StoreOptions } from '../interfaces';
import { SessionStore } from './SessionStore';

export interface StoreInstances {
  sessionStore: ISessionStore | null;
}

export class Store {
  /**
   * Creates a session store instance based on the specified storage mechanism.
   * Returns an object with the `sessionStore` property.
   *
   * @param storageType The type of storage mechanism (MEMORY or COOKIE).
   * @param options     Configuration options for the store.
   * @param logger      Optional logger.
   * @returns           An object containing `sessionStore`.
   */
  public static create(
    storageType: StorageMechanism,
    options?: StoreOptions,
    logger?: ILogger,
  ): StoreInstances {
    // 1) If the user provides a custom session store, use it directly.
    if (options?.session?.store) {
      return { sessionStore: options.session.store };
    }

    const DEFAULT_TTL = 3600000; // 1 hour

    switch (storageType) {
      case StorageMechanism.COOKIE: {
        const ttl = options?.storage?.ttl ?? DEFAULT_TTL;
        const internalStore = new MemoryStore(logger, ttl);
        const sessionStore = new CookieStore(
          options?.session?.cookie?.name,
          options?.session?.cookie?.options,
          internalStore,
        );
        return { sessionStore };
      }

      case StorageMechanism.MEMORY: {
        // Explicitly pass the default TTL so we call the constructor as the test expects
        const ttl = options?.storage?.ttl ?? DEFAULT_TTL;
        const sessionStore = new SessionStore(logger, ttl);
        return { sessionStore };
      }

      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }
}
