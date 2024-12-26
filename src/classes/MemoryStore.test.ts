import { MemoryStore } from './MemoryStore';
import { IStore, ISessionData, IMutex, ILogger } from '../interfaces';
import { Cache } from '../cache/Cache';
import { Mutex } from '../utils/Mutex';
import { randomUUID } from 'crypto';

jest.mock('../cache/Cache');
jest.mock('../utils/Mutex');
jest.mock('crypto');

describe('MemoryStore', () => {
  let logger: ILogger;
  let cacheMock: jest.Mocked<Cache<ISessionData>>;
  let mutexMock: jest.Mocked<Mutex>;
  let memoryStore: MemoryStore;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };

    cacheMock = new Cache<ISessionData>(logger, 3600000) as jest.Mocked<
      Cache<ISessionData>
    >;
    (Cache as jest.Mock).mockReturnValue(cacheMock);

    mutexMock = new Mutex(logger) as jest.Mocked<Mutex>;
    (Mutex as jest.Mock).mockReturnValue(mutexMock);

    memoryStore = new MemoryStore(logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('set', () => {
    it('should create a session and return the session ID', async () => {
      const data: ISessionData = { userId: 'user123' };
      const sid = 'unique-session-id';
      (randomUUID as jest.Mock).mockReturnValue(sid);
      mutexMock.runExclusive.mockImplementation(
        async (fn: () => Promise<string>) => fn(),
      );

      const result = await memoryStore.set(data);

      expect(randomUUID).toHaveBeenCalled();
      expect(cacheMock.set).toHaveBeenCalledWith(sid, data);
      expect(logger.debug).toHaveBeenCalledWith('Session created', { sid });
      expect(result).toBe(sid);
    });
  });

  describe('get', () => {
    it('should retrieve a session by ID', async () => {
      const sid = 'existing-session-id';
      const sessionData: ISessionData = { userId: 'user123' };
      cacheMock.get.mockReturnValue(sessionData);
      mutexMock.runExclusive.mockImplementation(
        async (fn: () => Promise<ISessionData | null>) => fn(),
      );

      const result = await memoryStore.get(sid);

      expect(cacheMock.get).toHaveBeenCalledWith(sid);
      expect(logger.debug).toHaveBeenCalledWith('Session retrieved', {
        sid,
        session: sessionData,
      });
      expect(result).toBe(sessionData);
    });

    it('should return null if session does not exist', async () => {
      const sid = 'nonexistent-session-id';
      cacheMock.get.mockReturnValue(undefined);
      mutexMock.runExclusive.mockImplementation(
        async (fn: () => Promise<ISessionData | null>) => fn(),
      );

      const result = await memoryStore.get(sid);

      expect(cacheMock.get).toHaveBeenCalledWith(sid);
      expect(logger.debug).toHaveBeenCalledWith('Session retrieved', {
        sid,
        session: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('destroy', () => {
    it('should delete a session by ID', async () => {
      const sid = 'session-to-delete';
      mutexMock.runExclusive.mockImplementation(
        async (fn: () => Promise<void>) => fn(),
      );

      await memoryStore.destroy(sid);

      expect(cacheMock.delete).toHaveBeenCalledWith(sid);
      expect(logger.debug).toHaveBeenCalledWith('Session deleted', { sid });
    });
  });

  describe('touch', () => {
    it("should update a session's TTL", async () => {
      const sid = 'session-to-touch';
      const sessionData: ISessionData = { passport: { sub: 'user123' } };
      mutexMock.runExclusive.mockImplementation(
        async (fn: () => Promise<void>) => fn(),
      );

      await memoryStore.touch(sid, sessionData);

      expect(cacheMock.set).toHaveBeenCalledWith(sid, sessionData);
      expect(logger.debug).toHaveBeenCalledWith('Session updated', { sid });
    });
  });
});
