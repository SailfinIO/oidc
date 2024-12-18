import { Pool } from './Pool';
import {
  PoolAcquireTimeoutError,
  PoolDrainingError,
  PoolResourceNotFoundError,
} from '../errors';
import { IFactory } from '../interfaces/IFactory';
import { IPoolOptions } from '../interfaces/IPool';

jest.useFakeTimers();
jest.mock('../utils/Logger');

describe('Pool', () => {
  let factory: IFactory<any>;
  let options: IPoolOptions;
  let pool: Pool<any>;

  beforeEach(async () => {
    factory = {
      create: jest.fn().mockResolvedValue({}),
      destroy: jest.fn().mockResolvedValue(undefined),
      validate: jest.fn().mockResolvedValue(true),
    };

    options = {
      minPoolSize: 2,
      maxPoolSize: 5,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    };

    pool = await Pool.initialize(factory, options);
  });

  afterEach(async () => {
    if (pool) {
      await pool.drain();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('initialize', () => {
    it('should populate the pool with the minimum number of resources', async () => {
      expect(factory.create).toHaveBeenCalledTimes(2);
      expect(pool).toBeInstanceOf(Pool);
    });
  });

  describe('acquire', () => {
    it('should acquire an available resource', async () => {
      const resource = await pool.acquire();
      expect(resource).toBeDefined();
    });

    it('should create a new resource if none are available', async () => {
      await pool.acquire();
      await pool.acquire();
      const newResource = await pool.acquire();
      expect(factory.create).toHaveBeenCalledTimes(2);
      expect(newResource).toBeDefined();
    });

    it('should throw a timeout error if acquiring a resource takes too long', async () => {
      options.acquireTimeoutMillis = 10; // Pool timeout
      pool = await Pool.initialize(factory, options);

      factory.create = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
        );

      const acquirePromise = pool.acquire();

      jest.advanceTimersByTime(20); // Advance time beyond timeout

      await expect(acquirePromise).rejects.toThrow(PoolAcquireTimeoutError);
    });

    it('should throw an error if the pool is draining', async () => {
      await pool.drain();
      await expect(pool.acquire()).rejects.toThrow(PoolDrainingError);
    });
  });

  describe('release', () => {
    it('should release a resource back to the pool', async () => {
      const resource = await pool.acquire();
      await pool.release(resource);
      expect(factory.validate).toHaveBeenCalledWith(resource);
    });

    it('should destroy a resource if it fails validation', async () => {
      factory.validate = jest.fn().mockResolvedValue(false);
      const resource = await pool.acquire();
      await pool.release(resource);
      expect(factory.destroy).toHaveBeenCalledWith(resource);
    });

    it('should throw an error if the resource is not part of the pool', async () => {
      const invalidResource = {};
      await expect(pool.release(invalidResource)).rejects.toThrow(
        PoolResourceNotFoundError,
      );
    });
  });

  describe('drain', () => {
    it('should drain the pool and destroy all resources', async () => {
      await pool.drain();
      expect(factory.destroy).toHaveBeenCalledTimes(2);
      await expect(pool.acquire()).rejects.toThrow(PoolDrainingError);
    });
  });

  describe('clear', () => {
    it('should clear the pool and reject all waiting clients', async () => {
      const acquirePromises = [
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
        pool.acquire(),
        pool.acquire(), // Exceeds maxPoolSize
      ];

      factory.create = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
        );

      const clearPromise = pool.clear();

      jest.advanceTimersByTime(10); // Allow clear to execute
      await jest.runOnlyPendingTimersAsync();

      await expect(clearPromise).resolves.toBeUndefined();

      jest.advanceTimersByTime(100); // Allow all pending ops to settle
      await jest.runOnlyPendingTimersAsync();

      const results = await Promise.allSettled(acquirePromises);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'fulfilled' }),
          expect.objectContaining({ status: 'fulfilled' }),
          expect.objectContaining({ status: 'fulfilled' }),
          expect.objectContaining({ status: 'fulfilled' }),
          expect.objectContaining({ status: 'fulfilled' }),
          expect.objectContaining({ status: 'rejected' }),
        ]),
      );
    });
  });
});
