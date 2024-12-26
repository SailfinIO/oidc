// src/classes/Store.ts

import { ILogger } from '../interfaces/ILogger';
import { IStore } from '../interfaces/IStore';
import { ISessionStore } from '../interfaces/ISessionStore';
import { MemoryStore } from './MemoryStore';
import { CookieStore } from './CookieStore';
import { Storage } from '../enums';
import { StoreOptions } from '../interfaces';

export interface StoreInstances {
  store: IStore;
  sessionStore: ISessionStore | null;
}

export class Store {
  /**
   * Creates store instances based on the specified storage mechanism.
   * Returns both `IStore` and `ISessionStore` if applicable.
   *
   * @param storageType The type of storage mechanism.
   * @param options Configuration options for the store.
   * @param logger Optional logger.
   * @returns An object containing both `IStore` and `ISessionStore` instances.
   */
  public static create(
    storageType: Storage,
    options?: StoreOptions,
    logger?: ILogger,
  ): StoreInstances {
    let store: IStore;
    let sessionStore: ISessionStore | null = null;

    switch (storageType) {
      case Storage.COOKIE: {
        // Create an internal IStore for CookieStore to use
        const internalStore =
          options?.session?.store ||
          new MemoryStore(logger, options?.storage?.ttl);
        sessionStore = new CookieStore(
          options?.session?.cookie?.name,
          options?.session?.cookie?.options,
          internalStore,
        );
        store = internalStore;
        break;
      }
      case Storage.MEMORY: {
        store = new MemoryStore(logger, options?.storage?.ttl);
        break;
      }
      default: {
        throw new Error(`Unsupported storage type: ${storageType}`);
      }
    }

    return { store, sessionStore };
  }
}
