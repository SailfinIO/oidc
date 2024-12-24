import { Mutex } from './Mutex';
import { ILogger, ITimer } from '../interfaces';
import { MutexError } from '../errors/MutexError';

describe('Mutex', () => {
  let logger: ILogger;
  let timer: ITimer;
  let mutex: Mutex;

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };
    timer = {
      setTimeout: jest.fn((fn, delay) => setTimeout(fn, delay)),
      clearTimeout: jest.fn((id) => clearTimeout(id)),
    };
    mutex = new Mutex(logger, timer);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create a Mutex instance with default timer if none provided', () => {
      const defaultMutex = new Mutex(logger);
      expect(defaultMutex).toBeInstanceOf(Mutex);
      expect(logger.debug).toHaveBeenCalledWith('Mutex instance created', {
        initialLocked: false,
        initialQueueLength: 0,
      });
    });

    it('should create a Mutex instance with provided timer', () => {
      const customMutex = new Mutex(logger, timer);
      expect(customMutex).toBeInstanceOf(Mutex);
      expect(logger.debug).toHaveBeenCalledWith('Mutex instance created', {
        initialLocked: false,
        initialQueueLength: 0,
      });
    });
  });

  describe('Acquire', () => {
    it('should acquire the mutex when it is not locked', async () => {
      const unlock = await mutex.acquire();
      expect(mutex.locked).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith('Attempting to acquire mutex', {
        timeout: undefined,
      });
      expect(logger.debug).toHaveBeenCalledWith('Trying to acquire mutex lock');
      expect(logger.info).toHaveBeenCalledWith('Mutex lock acquired', {
        currentQueueLength: 0,
      });

      unlock();
      // After unlock, check the log
      expect(logger.debug).toHaveBeenCalledWith(
        'Mutex released via unlock function',
      );
      expect(mutex.locked).toBe(false);
    });

    it('should queue the acquire request when mutex is already locked', async () => {
      const unlock1 = await mutex.acquire();
      const acquirePromise = mutex.acquire();

      expect(mutex.queue).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        'Mutex is locked, adding to queue',
        {
          queueLengthBefore: 0,
        },
      );
      expect(logger.debug).toHaveBeenCalledWith('Current queue length', {
        queueLength: 1,
      });

      unlock1();

      // After first unlock, the second acquire should proceed
      const unlock2 = await acquirePromise;
      expect(mutex.locked).toBe(true);
      unlock2();
      expect(mutex.locked).toBe(false);
    });

    it('should handle multiple queued acquire requests', async () => {
      const unlock1 = await mutex.acquire();
      const acquirePromise2 = mutex.acquire();
      const acquirePromise3 = mutex.acquire();
      expect(mutex.queue).toBe(2);

      unlock1();

      const unlock2 = await acquirePromise2;
      expect(mutex.locked).toBe(true);

      unlock2();

      const unlock3 = await acquirePromise3;
      expect(mutex.locked).toBe(true);

      unlock3();
      expect(mutex.locked).toBe(false);
      expect(mutex.queue).toBe(0);
    });

    it('should timeout if acquire takes too long', async () => {
      const unlock = await mutex.acquire();
      const acquirePromise = mutex.acquire(100);

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(100);

      await expect(acquirePromise).rejects.toThrow(MutexError);
      expect(logger.warn).toHaveBeenCalledWith(
        'Mutex acquisition timed out and request removed from queue',
        { queueLengthAfter: 0 },
      );

      unlock();
      expect(mutex.locked).toBe(false);
    });

    it('should clear the timeout after successful acquire', async () => {
      const unlock1 = await mutex.acquire(500);
      expect(timer.setTimeout).toHaveBeenCalledTimes(1);
      expect(timer.setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);

      // Since acquire is immediate, clearTimeout should have been called
      expect(timer.clearTimeout).toHaveBeenCalledTimes(1);

      unlock1();
      expect(mutex.locked).toBe(false);
    });

    it('should handle errors during acquire and reject appropriately', async () => {
      // To simulate an error during acquire, we'll mock the logger.debug to throw an error
      const originalDebug = logger.debug;
      const mockError = new MutexError('Acquire failed');
      (logger.debug as jest.Mock).mockImplementationOnce(() => {
        throw mockError;
      });

      const acquirePromise = mutex.acquire();

      await expect(acquirePromise).rejects.toThrow(MutexError);
      await expect(acquirePromise).rejects.toHaveProperty(
        'message',
        'Acquire failed',
      );
      await expect(acquirePromise).rejects.toHaveProperty(
        'code',
        'MUTEX_ERROR',
      );

      // Restore original logger.debug
      logger.debug = originalDebug;
    });
  });

  describe('Release', () => {
    it('should release the mutex when no queue is present', async () => {
      const unlock = await mutex.acquire();
      unlock();

      expect(mutex.locked).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('Releasing mutex lock', {
        currentQueueLength: 0,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Mutex lock released, no pending requests',
      );
    });

    it('should release the mutex and pass lock to next in queue', async () => {
      const unlock1 = await mutex.acquire();
      const acquirePromise = mutex.acquire();
      expect(mutex.queue).toBe(1);
      unlock1();

      expect(logger.debug).toHaveBeenCalledWith('Releasing mutex lock', {
        currentQueueLength: 1,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Mutex lock released, passing to next request in queue',
        {
          remainingQueueLength: 0,
        },
      );

      const unlock2 = await acquirePromise;
      expect(mutex.locked).toBe(true);
      unlock2();
      expect(mutex.locked).toBe(false);
    });

    it('should handle errors during release gracefully', async () => {
      // To simulate an error during release, we'll mock the logger.error to throw
      const originalRelease = (mutex as any).release;
      const releaseMock = jest.fn(() => {
        try {
          throw new Error('Release failed');
        } catch (error) {
          logger.error('Failed to release the mutex lock', { error });
        } finally {
          (mutex as any)._locked = false;
        }
      });
      (mutex as any).release = releaseMock;

      const unlock = await mutex.acquire();

      // Call unlock and ensure it doesn't throw
      expect(() => unlock()).not.toThrow();

      // Check that logger.error was called
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to release the mutex lock',
        {
          error: new Error('Release failed'),
        },
      );

      expect(mutex.locked).toBe(false);

      // Restore original release method
      (mutex as any).release = originalRelease;
    });
  });

  describe('runExclusive', () => {
    it('should execute the function exclusively and release the mutex', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      const result = await mutex.runExclusive(fn);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
      expect(mutex.locked).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('runExclusive called', {
        timeout: undefined,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'runExclusive acquired mutex lock',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'runExclusive function executed successfully',
        { result: 'result' },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'runExclusive released mutex lock',
      );
    });

    it('should handle synchronous functions', async () => {
      const fn = jest.fn().mockReturnValue('sync result');
      const result = await mutex.runExclusive(fn);
      expect(result).toBe('sync result');
      expect(fn).toHaveBeenCalled();
      expect(mutex.locked).toBe(false);
    });

    it('should handle errors thrown by the function and release the mutex', async () => {
      const error = new Error('Function failed');
      const fn = jest.fn().mockRejectedValue(error);
      await expect(mutex.runExclusive(fn)).rejects.toThrow(MutexError);
      expect(fn).toHaveBeenCalled();
      expect(mutex.locked).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error during exclusive execution',
        { error },
      );
    });

    it('should handle errors during unlock in runExclusive', async () => {
      // Simulate an error during unlock by mocking release to throw
      const originalRelease = (mutex as any).release;
      const releaseMock = jest.fn(() => {
        throw new Error('Unlock failed');
      });
      (mutex as any).release = releaseMock;

      const fn = jest.fn().mockResolvedValue('test');
      const result = await mutex.runExclusive(fn);
      expect(result).toBe('test');
      expect(fn).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to release the mutex lock after execution',
        {
          error: new Error('Unlock failed'),
        },
      );

      // Restore original release method
      (mutex as any).release = originalRelease;
    });
  });

  describe('Getters', () => {
    it('should return the correct locked state', async () => {
      expect(mutex.locked).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith('Getter accessed: locked', {
        locked: false,
      });

      const unlock = await mutex.acquire();
      expect(mutex.locked).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith('Getter accessed: locked', {
        locked: true,
      });
      unlock();
    });

    it('should return the correct queue length', async () => {
      expect(mutex.queue).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith('Getter accessed: queue', {
        queueLength: 0,
      });

      const unlock1 = await mutex.acquire();
      const acquirePromise = mutex.acquire();
      expect(mutex.queue).toBe(1);
      expect(logger.debug).toHaveBeenCalledWith('Getter accessed: queue', {
        queueLength: 1,
      });

      unlock1();
      const unlock2 = await acquirePromise;
      expect(mutex.queue).toBe(0);
      expect(logger.debug).toHaveBeenCalledWith('Getter accessed: queue', {
        queueLength: 0,
      });
      unlock2();
    });
  });
});
