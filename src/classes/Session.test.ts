// src/classes/Session.test.ts

import { Session } from './Session';
import {
  IClientConfig,
  ILogger,
  IToken,
  ISession,
  IUserInfo,
  ISessionData,
  ISessionStore,
} from '../interfaces';

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');
jest.spyOn(global, 'clearTimeout');

describe('Session', () => {
  let config: Partial<IClientConfig>;
  let logger: ILogger;
  let tokenClient: IToken;
  let userInfoClient: IUserInfo;
  let sessionStore: ISessionStore;
  let session: ISession;

  beforeEach(() => {
    config = {
      session: {
        useSilentRenew: true,
      },
      tokenRefreshThreshold: 60, // in seconds
    };
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      setLogLevel: jest.fn(),
    };
    tokenClient = {
      getAccessToken: jest.fn(),
      getTokens: jest.fn(),
      refreshAccessToken: jest.fn(),
      setTokens: jest.fn(),
      clearTokens: jest.fn(),
      introspectToken: jest.fn(),
      revokeToken: jest.fn(),
      exchangeCodeForToken: jest.fn(),
    };
    // Mock IUserInfo
    userInfoClient = {
      getUserInfo: jest.fn(),
    };
    // Mock IStore
    sessionStore = {
      get: jest.fn(),
      set: jest.fn(),
      touch: jest.fn(),
      destroy: jest.fn(),
    };
    // Instantiate Session with mocks
    session = new Session(
      config as IClientConfig,
      logger,
      tokenClient,
      userInfoClient,
      sessionStore,
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should schedule token refresh if useSilentRenew is true and existing session exists', async () => {
      // Arrange
      const mockSessionData: ISessionData = {
        cookie: {
          access_token: 'access-token',
          token_type: 'Bearer',
          expires_in: 120, // in seconds
        },
        user: { sub: 'user123' },
      };
      // Mock store.get to return existing session data
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSessionData);

      // Mock tokenClient.getTokens to return tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(
        mockSessionData.cookie,
      );

      // Create real Request and Response instances
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);

      // Assert
      expect(sessionStore.get).toHaveBeenCalledWith('mock-sid', context);
      expect(logger.debug).toHaveBeenCalledWith('Existing session found', {
        sid: 'mock-sid',
      });
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // (120 - 60) * 1000
      expect(logger.debug).toHaveBeenCalledWith('Scheduled token refresh in', {
        refreshTime: 60000,
      });
    });

    it('should create a new session if no existing session exists', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const mockUser: any = { sub: 'user456', name: 'Jane Doe' };

      // Mock sessionStore.get to return null, indicating no existing session
      (sessionStore.get as jest.Mock).mockResolvedValue(null);

      // Mock tokenClient.getTokens to return tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(mockTokens);

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('new-mock-sid');

      // Mock request and response objects with empty cookie
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: '',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      // Optionally, mock the append method if needed
      mockResponse.headers.append = jest.fn();

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);

      // Assert
      expect(sessionStore.get).not.toHaveBeenCalled(); // No existing session
      expect(sessionStore.set).toHaveBeenCalledWith(
        {
          cookie: mockTokens,
          user: mockUser,
        },
        context,
      );
      expect(logger.debug).toHaveBeenCalledWith('New session created', {
        sid: 'new-mock-sid',
      });
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // (120 - 60) * 1000
      expect(logger.debug).toHaveBeenCalledWith('Scheduled token refresh in', {
        refreshTime: 60000,
      });
    });

    it('should throw an error if no tokens are available to create a session', async () => {
      // Arrange
      // Mock sessionStore.get to return null, indicating no existing session
      (sessionStore.get as jest.Mock).mockResolvedValue(null);

      // Mock tokenClient.getTokens to return null
      (tokenClient.getTokens as jest.Mock).mockReturnValue(null);

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: '',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };

      // Act & Assert
      await expect(session.start(context)).rejects.toThrow(
        'No tokens available to create a session.',
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle failure to fetch user info gracefully', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };

      // Mock sessionStore.get to return null, indicating no existing session
      (sessionStore.get as jest.Mock).mockResolvedValue(null);

      // Mock tokenClient.getTokens to return tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(mockTokens);

      // Mock userInfoClient.getUserInfo to throw an error
      const userInfoError = new Error('Failed to fetch user info');
      (userInfoClient.getUserInfo as jest.Mock).mockRejectedValue(
        userInfoError,
      );

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('new-mock-sid');

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: '',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);

      // Assert
      expect(sessionStore.set).toHaveBeenCalledWith(
        {
          cookie: mockTokens,
          user: undefined,
        },
        context,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to fetch user info during session creation',
        { error: userInfoError },
      );
      expect(logger.debug).toHaveBeenCalledWith('New session created', {
        sid: 'new-mock-sid',
      });
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // (120 - 60) * 1000
    });
  });

  describe('stop', () => {
    it('should clear the session timer if it exists and reset sid', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const mockUser: any = { sub: 'user123' };

      const mockSessionData: ISessionData = {
        cookie: mockTokens,
        user: mockUser,
      };

      // Mock sessionStore.get to return existing session data
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSessionData);

      // Mock tokenClient.getTokens to return the tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(
        mockSessionData.cookie,
      );

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a valid session ID
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock sessionStore.destroy to handle destroying the session
      (sessionStore.destroy as jest.Mock).mockResolvedValue(undefined);

      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };

      // Act: Start the session first
      await session.start(context);

      // Act: Stop the session
      await session.stop(context);

      // Assert: Check that the session timer was cleared and the session was destroyed
      expect(clearTimeout).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Session timer cleared');
      expect(logger.debug).toHaveBeenCalledWith('Session destroyed', {
        sid: 'mock-sid',
      });
      expect(sessionStore.destroy).toHaveBeenCalledWith('mock-sid', context);
      expect(session.sid).toBeNull();
    });

    it('should do nothing if there is no session timer', () => {
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };
      // Act
      session.stop(context);

      // Assert
      expect(clearTimeout).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalledWith('Session timer cleared');
      expect(logger.debug).not.toHaveBeenCalledWith('Session stopped');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh the access token and reschedule refresh', async () => {
      // Arrange
      const initialTokens = {
        access_token: 'initial-token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const refreshedTokens = {
        access_token: 'refreshed-token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const mockUser: any = { sub: 'user123', name: 'John Doe' };

      // Mock sessionStore.get to return existing session data
      const mockSessionData: ISessionData = {
        cookie: initialTokens,
        user: mockUser,
      };
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSessionData);

      // Mock tokenClient.getTokens to return initialTokens first, then refreshedTokens
      (tokenClient.getTokens as jest.Mock)
        .mockReturnValueOnce(initialTokens) // First call during start
        .mockReturnValueOnce(refreshedTokens) // Second call during updateSession
        .mockReturnValueOnce(refreshedTokens); // Third call during scheduleTokenRefresh

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock tokenClient.refreshAccessToken to resolve successfully
      (tokenClient.refreshAccessToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Mock sessionStore.touch to simulate updating session
      (sessionStore.touch as jest.Mock).mockResolvedValue(undefined);

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      // Optionally, mock the append method if needed
      mockResponse.headers.append = jest.fn();

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);
      await (session as any).refreshToken(context);

      // Assert
      expect(tokenClient.refreshAccessToken).toHaveBeenCalled();
      expect(tokenClient.getTokens).toHaveBeenCalledTimes(3); // Updated from 2 to 3
      expect(sessionStore.touch).toHaveBeenCalledWith(
        'mock-sid',
        {
          cookie: refreshedTokens,
          user: mockUser,
        },
        context,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Access token refreshed successfully',
      );
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // (120 - 60) * 1000
    });

    it('should handle errors during token refresh and stop the session', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const mockUser: any = { sub: 'user123' };
      const refreshError = new Error('Refresh failed');

      // Mock sessionStore.get to return existing session data
      const mockSessionData: ISessionData = {
        cookie: mockTokens,
        user: mockUser,
      };
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSessionData);

      // Mock tokenClient.getTokens to return tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(
        mockSessionData.cookie,
      );

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock tokenClient.refreshAccessToken to reject
      (tokenClient.refreshAccessToken as jest.Mock).mockRejectedValue(
        refreshError,
      );

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);
      await (session as any).refreshToken(context);

      // Assert
      expect(tokenClient.refreshAccessToken).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        { error: refreshError },
      );
      expect(clearTimeout).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Session timer cleared');
      expect(session.sid).toBeNull();
    });
  });

  describe('scheduleTokenRefresh', () => {
    it('should handle successful token retrieval and schedule refresh', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 120, // in seconds
      };
      const mockUser: any = { sub: 'user123', name: 'John Doe' };

      // Mock tokenClient.getTokens to return tokens
      (tokenClient.getTokens as jest.Mock).mockReturnValue(mockTokens);

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      // Optionally, mock the append method if needed
      mockResponse.headers.append = jest.fn();

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);
      await (session as any).scheduleTokenRefresh(context);

      // Assert
      expect(tokenClient.getTokens).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60000); // (120 - 60) * 1000
      expect(logger.debug).toHaveBeenCalledWith('Scheduled token refresh in', {
        refreshTime: 60000,
      });
    });

    it('should handle token retrieval failure', async () => {
      // Arrange
      const getTokenError = new Error('Get token failed');

      // Mock sessionStore.get to return existing session data
      const mockSessionData: ISessionData = {
        cookie: {
          access_token: 'valid-token',
          token_type: 'Bearer',
          expires_in: 120, // in seconds
        },
        user: { sub: 'user123' },
      };
      (sessionStore.get as jest.Mock).mockResolvedValue(mockSessionData);

      // Mock tokenClient.getTokens
      (tokenClient.getTokens as jest.Mock)
        .mockResolvedValueOnce(mockSessionData.cookie) // Called during scheduleTokenRefresh in start
        .mockRejectedValueOnce(getTokenError); // Called during manual scheduleTokenRefresh

      // Mock userInfoClient.getUserInfo
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue({
        sub: 'user123',
      });

      // Mock sessionStore.set to return a new sid (not used in this path)
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = {
        headers: {
          append: jest.fn(),
        },
      } as unknown as Response;

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);

      // Reset mock calls after start to isolate manual invocation
      (tokenClient.getTokens as jest.Mock).mockClear();
      jest.spyOn(global, 'setTimeout').mockClear();

      // Now, set getTokens to reject on the next call (during scheduleTokenRefresh)
      (tokenClient.getTokens as jest.Mock).mockRejectedValueOnce(getTokenError);

      // Act again: manually invoke scheduleTokenRefresh
      await (session as any).scheduleTokenRefresh(context);

      // Assert
      expect(tokenClient.getTokens).toHaveBeenCalledTimes(1); // Only the manual call
      expect(tokenClient.getTokens).toHaveBeenCalledWith(); // Optionally, verify parameters
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to schedule token refresh',
        { error: getTokenError },
      );
      expect(setTimeout).not.toHaveBeenCalled(); // Should not schedule refresh due to failure
    });

    it('should not schedule refresh if token is missing', async () => {
      // Arrange
      // Mock tokenClient.getTokens to return valid tokens during start
      // and null during scheduleTokenRefresh
      (tokenClient.getTokens as jest.Mock)
        .mockImplementationOnce(() =>
          Promise.resolve({
            access_token: 'valid-token',
            token_type: 'Bearer',
            expires_in: 120, // in seconds
          }),
        )
        .mockImplementationOnce(() => Promise.resolve(null)); // During scheduleTokenRefresh

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue({
        sub: 'user123',
      });

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      mockResponse.headers.append = jest.fn();

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);

      // Reset mocks to ignore calls made during start
      jest.clearAllMocks();

      // Act again: manually invoke scheduleTokenRefresh
      await (session as any).scheduleTokenRefresh(context);

      // Assert
      expect(tokenClient.getTokens).toHaveBeenCalledTimes(1); // Only the manual call
      expect(setTimeout).not.toHaveBeenCalled(); // Should not schedule refresh
      expect(logger.debug).not.toHaveBeenCalledWith(
        'Scheduled token refresh in',
        {
          refreshTime: expect.any(Number),
        },
      );
    });

    it('should not schedule refresh if expires_in is missing', async () => {
      // Arrange
      const mockTokens = {
        access_token: 'token',
        token_type: 'Bearer',
        // expires_in is missing
      };
      const mockUser: any = { sub: 'user123', name: 'John Doe' };

      // Mock tokenClient.getTokens to return tokens without expires_in
      (tokenClient.getTokens as jest.Mock).mockReturnValue(mockTokens);

      // Mock userInfoClient.getUserInfo to return user info
      (userInfoClient.getUserInfo as jest.Mock).mockResolvedValue(mockUser);

      // Mock sessionStore.set to return a new sid
      (sessionStore.set as jest.Mock).mockResolvedValue('mock-sid');

      // Mock request and response objects
      const mockRequest = new Request('http://localhost', {
        headers: {
          cookie: 'sid=mock-sid',
        },
      });

      const mockResponse = new Response(null, {
        headers: new Headers(),
      });

      // Optionally, mock the append method if needed
      mockResponse.headers.append = jest.fn();

      const context = { request: mockRequest, response: mockResponse };

      // Act
      await session.start(context);
      await (session as any).scheduleTokenRefresh(context);

      // Assert
      expect(tokenClient.getTokens).toHaveBeenCalled();
      expect(setTimeout).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalledWith(
        'Scheduled token refresh in',
        {
          refreshTime: expect.any(Number),
        },
      );
    });
  });
});
