// src/classes/Store.ts

import { ILogger, IStore, StoreOptions } from '../interfaces';
import { MemoryStore } from './MemoryStore';
import { CookieStore } from './CookieStore';
import { Storage } from '../enums';

export class Store {
  /**
   * Creates a store based on the specified storage mechanism.
   * If a custom store is provided, it returns that store instead.
   *
   * @param storageType The type of storage mechanism.
   * @param options Configuration options for the store.
   * @param customStore Optional custom store implementation.
   * @param logger Optional logger.
   * @returns An instance of IStore.
   */
  public static create(
    storageType: Storage,
    options?: StoreOptions,
    customStore?: IStore,
    logger?: ILogger,
  ): IStore {
    if (customStore) {
      return customStore;
    }

    switch (storageType) {
      case Storage.COOKIE:
        // Create a MemoryStore or another server-side store
        const serverSideStore = new MemoryStore(logger, options?.defaultTTL);
        return new CookieStore(
          options?.cookieName,
          options?.cookieOptions,
          serverSideStore,
        );
      case Storage.MEMORY:
      default:
        return new MemoryStore(logger, options?.defaultTTL);
    }
  }
}
