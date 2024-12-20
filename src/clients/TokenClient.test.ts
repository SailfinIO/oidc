// tests/TokenClient.test.ts

import { TokenClient } from './TokenClient';
import {
  ITokenClient,
  ILogger,
  IClientConfig,
  IDiscoveryClient,
  IHttpClient,
} from '../interfaces';
import { ClientError } from '../errors/ClientError';

describe('TokenClient', () => {
  let tokenClient: ITokenClient;
  let mockLogger: ILogger;
  let mockConfig: IClientConfig;
  let mockDiscoveryClient: IDiscoveryClient;
  let mockHttpClient: IHttpClient;

  // Fixed timestamp for consistent testing (e.g., Jan 1, 2023 00:00:00 GMT)
  const fixedTimestamp = new Date('2023-01-01T00:00:00Z').getTime();

  beforeAll(() => {
    // Enable fake timers and set the system time
    jest.useFakeTimers();
    jest.setSystemTime(fixedTimestamp);
  });

  afterAll(() => {
    // Restore real timers after all tests
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockLogger = {
      setLogLevel: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    mockConfig = {
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/callback',
      scopes: ['openid', 'profile'],
      discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      tokenRefreshThreshold: 60,
      // No clientSecret provided
    };

    mockDiscoveryClient = {
      getDiscoveryConfig: jest.fn().mockResolvedValue({
        token_endpoint: 'https://example.com/oauth/token',
        introspection_endpoint: 'https://example.com/oauth/introspect',
        revocation_endpoint: 'https://example.com/oauth/revoke',
        // Add other necessary IDiscoveryConfig properties
      }),
    };

    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      trace: jest.fn(),
      connect: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
    };

    tokenClient = new TokenClient(
      mockLogger,
      mockConfig,
      mockDiscoveryClient,
      mockHttpClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token successfully', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      });

      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      };

      (mockHttpClient.post as jest.Mock).mockResolvedValue(
        JSON.stringify(mockTokenResponse),
      );

      // Act
      await tokenClient.refreshAccessToken();

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        'grant_type=refresh_token&refresh_token=valid-refresh-token&client_id=test-client-id',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Access token refreshed successfully',
      );

      const tokens = tokenClient.getTokens();
      expect(tokens).toMatchObject({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
      });
      expect(tokens?.expires_in).toBe(3600);
    });

    it('should throw an error if no refresh token is available', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        token_type: 'Bearer',
      });

      // Act & Assert
      await expect(tokenClient.refreshAccessToken()).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        expect.any(ClientError),
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      // Arrange
      tokenClient.setTokens({
        access_token: 'old-access-token',
        refresh_token: 'invalid-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      const mockError = new ClientError('HTTP Error', 'HTTP_ERROR');
      (mockHttpClient.post as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(tokenClient.refreshAccessToken()).rejects.toThrow(
        ClientError,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh access token',
        mockError,
      );
    });
  });

  // Additional tests for other methods...
});
