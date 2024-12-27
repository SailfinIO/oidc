// src/classes/Store.test.ts

import { Store } from './Store';
import { MemoryStore } from './MemoryStore';
import { CookieStore } from './CookieStore';
import { Storage } from '../enums';
import { ILogger, StoreOptions, IStore, ISessionStore } from '../interfaces';

jest.mock('./MemoryStore');
jest.mock('./CookieStore');

describe('Store', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return a MemoryStore when storage type is MEMORY', () => {
      const options: StoreOptions = { storage: { ttl: 3600 } };

      const result = Store.create(Storage.MEMORY, options, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, options.storage.ttl);
      expect(result.store).toBeInstanceOf(MemoryStore);
      expect(result.sessionStore).toBeNull();
    });

    it('should create and return a CookieStore when storage type is COOKIE', () => {
      const options: StoreOptions = {
        storage: { ttl: 3600 },
        session: {
          cookie: {
            name: 'session',
            options: { path: '/', httpOnly: true },
          },
        },
      };

      const result = Store.create(Storage.COOKIE, options, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, options.storage.ttl);
      expect(CookieStore).toHaveBeenCalledWith(
        options.session.cookie.name,
        options.session.cookie.options,
        expect.any(MemoryStore),
      );
      expect(result.store).toBeInstanceOf(MemoryStore);
      expect(result.sessionStore).toBeInstanceOf(CookieStore);
    });

    it('should use a custom store for CookieStore if provided', () => {
      const customStore: IStore = {
        set: jest.fn(),
        get: jest.fn(),
        destroy: jest.fn(),
        touch: jest.fn(),
      };

      const options: StoreOptions = {
        session: {
          store: customStore,
          cookie: {
            name: 'custom-session',
            options: { path: '/custom', httpOnly: false },
          },
        },
      };

      const result = Store.create(Storage.COOKIE, options, logger);

      expect(CookieStore).toHaveBeenCalledWith(
        options.session.cookie.name,
        options.session.cookie.options,
        customStore,
      );
      expect(result.store).toBe(customStore);
      expect(result.sessionStore).toBeInstanceOf(CookieStore);
    });

    it('should default to MemoryStore when no options are provided', () => {
      const result = Store.create(Storage.MEMORY, undefined, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, undefined);
      expect(result.store).toBeInstanceOf(MemoryStore);
      expect(result.sessionStore).toBeNull();
    });

    it('should throw an error for unsupported storage types', () => {
      expect(() => {
        Store.create('unsupported' as Storage, undefined, logger);
      }).toThrowError('Unsupported storage type: unsupported');
    });
  });

  describe('Integration with logger', () => {
    it('should pass the logger to the MemoryStore', () => {
      const options: StoreOptions = { storage: { ttl: 3600 } };

      Store.create(Storage.MEMORY, options, logger);

      expect(MemoryStore).toHaveBeenCalledWith(logger, options.storage.ttl);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should pass the logger to the CookieStore', () => {
      const options: StoreOptions = {
        session: {
          cookie: {
            name: 'test-cookie',
            options: { path: '/', httpOnly: true },
          },
        },
      };

      Store.create(Storage.COOKIE, options, logger);

      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});
