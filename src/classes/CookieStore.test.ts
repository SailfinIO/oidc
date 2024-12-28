import { CookieStore } from './CookieStore';
import { MemoryStore } from './MemoryStore';
import { IStoreContext, ISessionData, IUser } from '../interfaces';
import { SameSite } from '../enums';
import { Cookie } from '../utils/Cookie';

describe('CookieStore', () => {
  let cookieStore: CookieStore;
  let context: IStoreContext;

  const mockUser: IUser = { sub: 'user123' };
  const mockCookie = {
    access_token: 'mockAccessToken',
    refresh_token: 'mockRefreshToken',
    expires_in: 3600,
    token_type: 'Bearer',
  };

  const mockRequest = new Request('http://localhost', {
    headers: {
      cookie: 'sid=mock-sid',
    },
  });

  const mockResponse = new Response(null, {
    headers: new Headers(),
  });

  beforeEach(() => {
    const memoryStore = new MemoryStore();
    cookieStore = new CookieStore(
      'test_sid',
      {
        httpOnly: true,
        secure: false,
        sameSite: SameSite.STRICT,
        path: '/',
        maxAge: 100,
      },
      memoryStore,
    );
    context = { request: mockRequest, response: mockResponse };
    // Mock the append method on response headers
    context.response.headers.append = jest.fn();
  });

  it('should set a new session and return a session ID', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);
    expect(sid).toBeDefined();
    expect(mockResponse.headers.append).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('test_sid=' + sid),
    );
  });

  it('should return null if request object is missing', async () => {
    await expect(
      cookieStore.get('invalid', { response: mockResponse }),
    ).rejects.toThrow('Request object is required to get cookies.');
  });

  it('manual test for MemoryStore', async () => {
    const memoryStore = new MemoryStore();
    const sid = 'test-sid';
    const data: ISessionData = { cookie: mockCookie, user: mockUser };

    await memoryStore.set(sid, data);
    const retrievedData = await memoryStore.get(sid);

    expect(retrievedData).toEqual(data);
  });

  it('should get stored session data if cookie matches', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    // Set the 'test_sid' cookie in the 'Cookie' header
    context.request = new Request('http://localhost', {
      headers: {
        cookie: `test_sid=${sid}`,
      },
    });

    const session = await cookieStore.get(sid, context);
    expect(session).toEqual(data);
  });

  it('should return null if session ID mismatches', async () => {
    mockRequest.headers.set('Cookie', `test_sid=unknownSid`);
    const session = await cookieStore.get('someSid', context);
    expect(session).toBeNull();
  });

  it('should destroy the session and expire the cookie', async () => {
    const sid = await cookieStore.set(
      { cookie: mockCookie, user: mockUser },
      context,
    );
    await cookieStore.destroy(sid, context);
    expect(mockResponse.headers.append).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('test_sid=;'),
    );
  });

  it('should touch session and reset cookie maxAge', async () => {
    const sid = await cookieStore.set(
      { cookie: mockCookie, user: mockUser },
      context,
    );
    await cookieStore.touch(
      sid,
      { cookie: mockCookie, user: mockUser },
      context,
    );
    expect(mockResponse.headers.append).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining(`test_sid=${sid}`),
    );
  });

  it('should use MemoryStore by default if no dataStore is provided', () => {
    const defaultStore = new CookieStore('default_sid');
    expect((defaultStore as any).dataStore).toBeInstanceOf(MemoryStore);
  });

  it('should log error and return null if cookie parsing fails', async () => {
    // Arrange

    // Mock Cookie.parse to throw an error
    const parseError = new Error('Parsing failed');
    const parseSpy = jest.spyOn(Cookie, 'parse').mockImplementation(() => {
      throw parseError;
    });

    // Spy on the logger.error method
    const loggerErrorSpy = jest.spyOn(cookieStore['logger'], 'error');

    // Act
    const session = await cookieStore.get('someSid', context);

    // Assert
    expect(session).toBeNull();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Error parsing session cookie',
      { error: parseError },
    );

    // Cleanup
    parseSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  it('should throw an error when setting a session without a response object', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const invalidContext: IStoreContext = { request: mockRequest };
    await expect(cookieStore.set(data, invalidContext)).rejects.toThrow(
      'Response object is required to set cookies.',
    );
  });

  it('should return null when getting a session if cookie header is missing', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    // Remove the cookie header
    context.request = new Request('http://localhost', {
      headers: {},
    });

    const session = await cookieStore.get(sid, context);
    expect(session).toBeNull();
  });

  it('should return null when getting a session if cookie header is not a string', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    const originalGet = Headers.prototype.get;
    Headers.prototype.get = jest.fn().mockReturnValue(123 as any);

    const session = await cookieStore.get(sid, context);
    expect(session).toBeNull();

    // Restore the original get method
    Headers.prototype.get = originalGet;
  });

  it('should return null when getting a session if session cookie is not found', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    // Set the 'test_sid' cookie to a different name
    context.request = new Request('http://localhost', {
      headers: {
        cookie: `other_cookie=${sid}`,
      },
    });

    const session = await cookieStore.get(sid, context);
    expect(session).toBeNull();
  });

  it('should throw an error when destroying a session without a response object', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    const invalidContext: IStoreContext = { request: mockRequest };
    await expect(cookieStore.destroy(sid, invalidContext)).rejects.toThrow(
      'Response object is required to destroy cookies.',
    );
  });

  it('should throw an error when touching a session without a response object', async () => {
    const data: ISessionData = { cookie: mockCookie, user: mockUser };
    const sid = await cookieStore.set(data, context);

    const invalidContext: IStoreContext = { request: mockRequest };
    await expect(cookieStore.touch(sid, data, invalidContext)).rejects.toThrow(
      'Response object is required to touch cookies.',
    );
  });

  it('should use the default cookieName "sid" when none is provided', () => {
    const defaultStore = new CookieStore(); // No arguments provided
    expect(defaultStore['cookieName']).toBe('sid');
  });
});
