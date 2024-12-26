import { Store } from './Store';
import { IStore, ILogger, StoreOptions } from '../interfaces';
import { Storage } from '../enums';
import { MemoryStore } from './MemoryStore';
import { CookieStore } from './CookieStore';

// src/classes/Store.test.ts

jest.mock('./MemoryStore');
jest.mock('./CookieStore');

describe('Store', () => {
  describe('create', () => {
    it('should return the custom store if provided', () => {
      const customStore: IStore = {} as IStore;
      const result = Store.create(Storage.MEMORY, undefined, customStore);
      expect(result).toBe(customStore);
    });

    it('should create and return a MemoryStore when storage type is MEMORY', () => {
      const logger: ILogger = {} as ILogger;
      const options: StoreOptions = { defaultTTL: 3600 };
      const result = Store.create(Storage.MEMORY, options, undefined, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, options.defaultTTL);
      expect(result).toBeInstanceOf(MemoryStore);
    });

    it('should create and return a CookieStore when storage type is COOKIE', () => {
      const logger: ILogger = {} as ILogger;
      const options: StoreOptions = {
        defaultTTL: 3600,
        cookieName: 'testCookie',
        cookieOptions: { path: '/', httpOnly: true },
      };
      const result = Store.create(Storage.COOKIE, options, undefined, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, options.defaultTTL);
      expect(CookieStore).toHaveBeenCalledWith(
        options.cookieName,
        options.cookieOptions,
        expect.any(MemoryStore),
      );
      expect(result).toBeInstanceOf(CookieStore);
    });

    it('should default to MemoryStore when storage type is not specified', () => {
      const logger: ILogger = {} as ILogger;
      const result = Store.create(Storage.MEMORY, undefined, undefined, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, undefined);
      expect(result).toBeInstanceOf(MemoryStore);
    });
  });
});
