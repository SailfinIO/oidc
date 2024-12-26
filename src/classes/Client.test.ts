// src/classes/Client.test.ts

import { Client } from './Client';
import { Auth } from './Auth';
import { UserInfo } from './UserInfo';
import { Logger } from '../utils';
import { Token } from './Token';
import { ClientError } from '../errors';
import { GrantType, LogLevel, Scopes, TokenTypeHint, Storage } from '../enums';
import { Issuer } from './Issuer';
import { IStoreContext, IStore, ISessionData } from '../interfaces';
import { Store } from './Store';
import * as utils from '../utils';
import { Session } from './Session';

// Set environment variables if needed
process.env.OIDC_CLIENT_LOG_LEVEL = 'DEBUG';

// Mock dependencies
jest.mock('./Auth');
jest.mock('./UserInfo');
jest.mock('./Session');
jest.mock('../utils');
jest.mock('./Issuer');
jest.mock('./Store');
jest.mock('./Token');

// Provide a mock implementation for the 'parse' function
(utils.parse as jest.Mock).mockImplementation((cookieHeader: string) => {
  // Simple parser for 'key=value' pairs
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = value;
    }
  });
  return cookies;
});

// Define a mock Token instance
const mockTokenInstance = {
  getTokens: jest.fn().mockReturnValue({
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    expires_in: 3600,
  }),
  introspectToken: jest.fn().mockResolvedValue({
    active: true,
    scope: 'openid profile',
  }),
  revokeToken: jest.fn().mockResolvedValue(undefined),
  getAccessToken: jest.fn().mockResolvedValue('access_token'),
  clearTokens: jest.fn(),
  refreshAccessToken: jest.fn().mockResolvedValue(undefined),
};

// Configure the mocked Token class to return the mockTokenInstance
(Token as jest.Mock).mockImplementation(() => mockTokenInstance);

// Define a mock Issuer instance
const mockIssuerInstance = {
  discover: jest.fn().mockResolvedValue({
    issuer: 'https://example.com',
    authorization_endpoint: 'https://example.com/auth',
    token_endpoint: 'https://example.com/token',
    userinfo_endpoint: 'https://example.com/userinfo',
    introspection_endpoint: 'https://example.com/introspect',
    revocation_endpoint: 'https://example.com/revoke',
  }),
};

// Configure the mocked Issuer class to return the mockIssuerInstance
(Issuer as jest.Mock).mockImplementation(() => mockIssuerInstance);

// Define a mock Auth instance
const mockAuthInstance = {
  getAuthorizationUrl: jest.fn().mockResolvedValue({
    url: 'https://example.com/auth',
    state: 'random-state',
  }),
  handleRedirect: jest.fn().mockResolvedValue(undefined),
  handleRedirectForImplicitFlow: jest.fn().mockResolvedValue(undefined),
  startDeviceAuthorization: jest.fn().mockResolvedValue({
    device_code: 'device_code',
    user_code: 'user_code',
    verification_uri: 'https://example.com/verify',
    expires_in: 1800,
    interval: 5,
  }),
  pollDeviceToken: jest.fn().mockResolvedValue(undefined),
  getLogoutUrl: jest.fn().mockResolvedValue('https://example.com/logout'),
};

// Configure the mocked Auth class to return the mockAuthInstance
(Auth as jest.Mock).mockImplementation(() => mockAuthInstance);

// Define a mock UserInfo instance
const mockUserInfoInstance = {
  getUserInfo: jest.fn().mockResolvedValue({
    id: 'user123',
    name: 'Test User',
  }),
};

// Configure the mocked UserInfo class to return the mockUserInfoInstance
(UserInfo as jest.Mock).mockImplementation(() => mockUserInfoInstance);

// Mock the Session class
jest.mock('./Session');

// Define a mock Session instance
const mockSessionInstance = {
  sid: 'mock_sid',
  start: jest.fn(),
  stop: jest.fn(),
};

// Configure the mocked Session class to return the mockSessionInstance
(Session as jest.Mock).mockImplementation(() => mockSessionInstance);

// Implement an in-memory mock store
const mockStoreData: Record<string, ISessionData> = {};

const mockStore: IStore = {
  set: jest
    .fn()
    .mockImplementation((data: ISessionData, context: IStoreContext) => {
      // Simulate generating a session ID and storing session data
      const sid = mockSessionInstance.sid; // Use the mocked sid
      mockStoreData[sid] = data;
      return Promise.resolve(sid);
    }),
  get: jest.fn().mockImplementation((sid: string) => {
    return Promise.resolve(mockStoreData[sid] || null);
  }),
  destroy: jest
    .fn()
    .mockImplementation((sid: string, context: IStoreContext) => {
      delete mockStoreData[sid];
      return Promise.resolve();
    }),
  touch: jest.fn().mockResolvedValue(undefined),
};

// Mock the Store.create static method to return mockStore
(Store as any).create = jest.fn().mockReturnValue(mockStore);

// Define a mock Logger instance with setLogLevel and debug methods
const mockLoggerInstance = {
  setLogLevel: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Configure the mocked Logger class to return the mockLoggerInstance
(Logger as jest.Mock).mockImplementation(() => mockLoggerInstance);

// Define a mock context to be used in tests
const mockContext: IStoreContext = {
  request: {
    headers: {
      get: jest.fn().mockReturnValue('sid=mock_sid'), // Mock the 'cookie' header
    },
  } as unknown as Request, // Type assertion to satisfy TypeScript
  response: {
    setHeader: jest.fn(),
    writeHead: jest.fn(),
    end: jest.fn(),
  } as unknown as Response,
};

describe('Client', () => {
  let client: Client;
  const mockConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client',
    redirectUri: 'https://example.com/callback',
    scopes: ['openid', 'profile'],
    discoveryUrl: 'https://example.com/.well-known/openid-configuration',
    session: {
      useSilentRenew: true,
      cookie: {
        name: 'mock_sid',
        secret: 'cookie-secret',
      },
    },
    storage: {
      mechanism: Storage.MEMORY,
    },
    logging: {
      logLevel: LogLevel.INFO,
    },
  };

  beforeEach(() => {
    // Reset all mock implementations and calls before each test
    jest.clearAllMocks();

    // Instantiate the Client with the mockConfig
    client = new Client(mockConfig);
  });

  it('should initialize with default config', () => {
    expect(client).toBeDefined();
    // Additional initialization assertions can be added here
  });

  it('should throw error if required config is missing', () => {
    expect(() => new Client({ clientId: 'test' } as any)).toThrow(ClientError);
  });

  it('should get authorization URL', async () => {
    const result = await client.getAuthorizationUrl();
    expect(result).toEqual({
      url: 'https://example.com/auth',
      state: 'random-state',
    });
    expect(mockAuthInstance.getAuthorizationUrl).toHaveBeenCalled();
  });

  it('should handle redirect with valid code and state', async () => {
    await expect(
      client.handleRedirect('auth-code', 'state', mockContext),
    ).resolves.toBeUndefined();
    expect(mockAuthInstance.handleRedirect).toHaveBeenCalledWith(
      'auth-code',
      'state',
    );

    // Verify that store.set was called with sessionData and context
    expect(mockStore.set).toHaveBeenCalledWith(
      {
        cookie: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expires_in: 3600,
        },
        passport: { id: 'user123', name: 'Test User' },
      },
      mockContext,
    );
  });

  it('should handle redirect for implicit flow', async () => {
    await expect(
      client.handleRedirectForImplicitFlow('fragment', mockContext),
    ).resolves.toBeUndefined();
    expect(mockAuthInstance.handleRedirectForImplicitFlow).toHaveBeenCalledWith(
      'fragment',
    );

    // Verify that store.set was called with sessionData and context
    expect(mockStore.set).toHaveBeenCalledWith(
      {
        cookie: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expires_in: 3600,
        },
        passport: { id: 'user123', name: 'Test User' },
      },
      mockContext,
    );
  });

  it('should retrieve user info', async () => {
    const userInfo = await client.getUserInfo();
    expect(userInfo).toEqual({ id: 'user123', name: 'Test User' });
    expect(mockUserInfoInstance.getUserInfo).toHaveBeenCalled();
  });

  it('should introspect token', async () => {
    const response = await client.introspectToken('token123');
    expect(response).toEqual({ active: true, scope: 'openid profile' });
    expect(mockTokenInstance.introspectToken).toHaveBeenCalledWith('token123');
  });

  it('should revoke token', async () => {
    await expect(
      client.revokeToken('token123', TokenTypeHint.AccessToken),
    ).resolves.toBeUndefined();
    expect(mockTokenInstance.revokeToken).toHaveBeenCalledWith(
      'token123',
      TokenTypeHint.AccessToken,
    );
  });

  it('should start device authorization', async () => {
    const result = await client.startDeviceAuthorization();
    expect(result).toEqual({
      device_code: 'device_code',
      user_code: 'user_code',
      verification_uri: 'https://example.com/verify',
      expires_in: 1800,
      interval: 5,
    });
    expect(mockAuthInstance.startDeviceAuthorization).toHaveBeenCalled();
  });

  it('should poll device token', async () => {
    await expect(
      client.pollDeviceToken('device_code', 5, undefined, mockContext),
    ).resolves.toBeUndefined();
    expect(mockAuthInstance.pollDeviceToken).toHaveBeenCalledWith(
      'device_code',
      5,
      undefined,
    );

    // Verify that store.set was called with sessionData and context
    expect(mockStore.set).toHaveBeenCalledWith(
      {
        cookie: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expires_in: 3600,
        },
        passport: { id: 'user123', name: 'Test User' },
      },
      mockContext,
    );
  });

  it('should get access token', async () => {
    const accessToken = await client.getAccessToken();
    expect(accessToken).toBe('access_token');
    expect(mockTokenInstance.getAccessToken).toHaveBeenCalled();
  });

  it('should get tokens', async () => {
    const tokens = await client.getTokens();
    expect(tokens).toEqual({
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expires_in: 3600,
    });
    expect(mockTokenInstance.getTokens).toHaveBeenCalled();
  });

  it('should clear tokens', async () => {
    await expect(client.clearTokens(mockContext)).resolves.toBeUndefined();
    expect(mockTokenInstance.clearTokens).toHaveBeenCalled();
    expect(mockStore.destroy).toHaveBeenCalledWith('mock_sid', mockContext);
    expect(mockSessionInstance.stop).toHaveBeenCalled();
  });

  it('should initiate logout', async () => {
    const logoutUrl = await client.logout('id_token_hint');
    expect(logoutUrl).toBe('https://example.com/logout');
    expect(mockAuthInstance.getLogoutUrl).toHaveBeenCalledWith('id_token_hint');
  });

  it('should set log level', () => {
    client.setLogLevel(LogLevel.DEBUG);
    expect(mockLoggerInstance.setLogLevel).toHaveBeenCalledWith(LogLevel.DEBUG);
  });

  it('should default grantType to AuthorizationCode if not provided', () => {
    const configWithoutGrantType = {
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/callback',
      scopes: [Scopes.OpenId, Scopes.Profile],
      discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      grantType: undefined, // Explicitly set grantType to undefined
      logging: {
        logLevel: LogLevel.DEBUG,
      },
    };

    const debugSpy = jest
      .spyOn(mockLoggerInstance, 'debug')
      .mockImplementation(() => {});

    // Instantiate a new Client with configWithoutGrantType
    const clientWithoutGrantType = new Client(configWithoutGrantType);

    expect((clientWithoutGrantType as any).config.grantType).toBe(
      GrantType.AuthorizationCode,
    );
    expect(debugSpy).toHaveBeenCalledWith(
      'No grantType specified, defaulting to authorization_code',
    );

    debugSpy.mockRestore();
  });
});
