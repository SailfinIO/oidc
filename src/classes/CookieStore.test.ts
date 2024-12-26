import { CookieStore } from './CookieStore';
import { IStore, ISessionData, IStoreContext } from '../interfaces';
import { SameSite } from '../enums';
import { Mutex, serialize, parse } from '../utils';
import { randomUUID } from 'crypto';

// src/classes/CookieStore.test.ts

jest.mock('crypto', () => ({
  randomUUID: jest.fn(),
}));

jest.mock('../utils', () => ({
  Mutex: jest.fn().mockImplementation(() => ({
    runExclusive: jest.fn((fn) => fn()),
  })),
  serialize: jest.fn(),
  parse: jest.fn(),
}));

describe('CookieStore', () => {
  let mockDataStore: jest.Mocked<IStore>;
  let cookieStore: CookieStore;
  let context: IStoreContext;

  beforeEach(() => {
    mockDataStore = {
      set: jest.fn(),
      get: jest.fn(),
      destroy: jest.fn(),
      touch: jest.fn(),
    };
    cookieStore = new CookieStore(
      'testSid',
      {
        httpOnly: true,
        secure: true,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 3600,
      },
      mockDataStore,
    );
    context = {
      request: new Request('', {
        headers: new Headers({
          cookie: 'testSid=1234',
        }),
      }),
      response: {
        headers: {
          append: jest.fn(),
          delete: jest.fn(),
          get: jest.fn(),
          getSetCookie: jest.fn(),
          has: jest.fn(),
          set: jest.fn(),
          forEach: jest.fn(),
        },
      },
    };
    (randomUUID as jest.Mock).mockReturnValue('unique-id');
    (serialize as jest.Mock).mockReturnValue('serialized-cookie');
    (parse as jest.Mock).mockReturnValue({ testSid: '1234' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('set', () => {
    it('should set a cookie and store session data', async () => {
      const sessionData: ISessionData = { user: 'testUser' };
      const sid = await cookieStore.set(sessionData, context);
      expect(mockDataStore.set).toHaveBeenCalledWith(sessionData);
      expect(randomUUID).toHaveBeenCalled();
      expect(serialize).toHaveBeenCalledWith('testSid', 'unique-id', {
        httpOnly: true,
        secure: true,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 3600,
      });
      expect(context.response.headers.append).toHaveBeenCalledWith(
        'Set-Cookie',
        'serialized-cookie',
      );
      expect(sid).toBe('unique-id');
    });

    it('should throw an error if context.response is missing', async () => {
      await expect(cookieStore.set({}, {})).rejects.toThrow(
        'Response object is required to set cookies.',
      );
    });
  });

  describe('get', () => {
    it('should retrieve session data by sid', async () => {
      mockDataStore.get.mockResolvedValue({ user: 'testUser' });
      const data = await cookieStore.get('1234', context);
      expect(parse).toHaveBeenCalledWith('testSid=1234');
      expect(mockDataStore.get).toHaveBeenCalledWith('1234');
      expect(data).toEqual({ user: 'testUser' });
    });

    it('should return null if cookie header is missing', async () => {
      const emptyContext: IStoreContext = { request: { headers: {} } };
      const data = await cookieStore.get('1234', emptyContext);
      expect(data).toBeNull();
    });

    it('should return null if sessionId does not match', async () => {
      (parse as jest.Mock).mockReturnValue({ testSid: 'wrong-id' });
      const data = await cookieStore.get('1234', context);
      expect(data).toBeNull();
    });

    it('should throw an error if context.request is missing', async () => {
      await expect(cookieStore.get('1234', {})).rejects.toThrow(
        'Request object is required to get cookies.',
      );
    });
  });

  describe('destroy', () => {
    it('should destroy session data and expire the cookie', async () => {
      await cookieStore.destroy('1234', context);
      expect(mockDataStore.destroy).toHaveBeenCalledWith('1234');
      expect(serialize).toHaveBeenCalledWith('testSid', '', {
        httpOnly: true,
        secure: true,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 0,
      });
      expect(context.response.headers.append).toHaveBeenCalledWith(
        'Set-Cookie',
        'serialized-cookie',
      );
    });

    it('should throw an error if context.response is missing', async () => {
      await expect(cookieStore.destroy('1234', {})).rejects.toThrow(
        'Response object is required to destroy cookies.',
      );
    });
  });

  describe('touch', () => {
    it('should update session data and reset cookie maxAge', async () => {
      const sessionData: ISessionData = { user: 'testUser' };
      await cookieStore.touch('1234', sessionData, context);
      expect(mockDataStore.touch).toHaveBeenCalledWith('1234', sessionData);
      expect(serialize).toHaveBeenCalledWith('testSid', '1234', {
        httpOnly: true,
        secure: true,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 3600,
      });
      expect(context.response.headers.append).toHaveBeenCalledWith(
        'Set-Cookie',
        'serialized-cookie',
      );
    });

    it('should throw an error if context.response is missing', async () => {
      await expect(cookieStore.touch('1234', {}, {})).rejects.toThrow(
        'Response object is required to touch cookies.',
      );
    });
  });
});
